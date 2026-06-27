"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActivityCategory,
  FocusCheckStoredState,
  ScreenCheckExpectedContext,
  ScreenCheckPrivateResult,
  ScreenCheckResultKind
} from "@/lib/types";

type CaptureStatus = "idle" | "requesting" | "connecting" | "active" | "paused" | "error";
type AnalysisMode = "local" | "cloud";

type UseScreenCheckSessionOptions = {
  goal: string;
  subject: string;
  expectedContexts: ScreenCheckExpectedContext[];
  activityCategory?: ActivityCategory;
  privateFocusCheckState?: FocusCheckStoredState | null;
  focusCheckOpen: boolean;
  isFocusPhase: boolean;
  pauseRequested: boolean;
  pauseReason: string;
};

type CloudResult = {
  alignment: "aligned" | "unclear" | "likely_mismatch";
};

const CHECK_DELAYS_MS = [2, 3, 4].map((minutes) => minutes * 60 * 1000);
const FRESH_FRAME_LIMIT_MS = 15_000;

export function useScreenCheckSession(options: UseScreenCheckSessionOptions) {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [trackReadyState, setTrackReadyState] = useState<MediaStreamTrackState | "none">("none");
  const [endedEventFired, setEndedEventFired] = useState(false);
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [lastPrivateCheckAt, setLastPrivateCheckAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<ScreenCheckResultKind | "none">("none");
  const [privateResult, setPrivateResult] = useState<ScreenCheckPrivateResult | null>(null);
  const [freshFrame, setFreshFrame] = useState(false);
  const [testMessage, setTestMessage] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastErrorName, setLastErrorName] = useState("none");
  const [lastErrorMessage, setLastErrorMessage] = useState("");
  const [browserSupported, setBrowserSupported] = useState(false);
  const [pickerOpened, setPickerOpened] = useState(false);
  const [pauseMessage, setPauseMessage] = useState("");
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("local");
  const [lastAnalysisMode, setLastAnalysisMode] = useState<AnalysisMode>("local");
  const [consecutiveResetSuggestions, setConsecutiveResetSuggestions] = useState(0);
  const [scheduleVersion, setScheduleVersion] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const healthTimerRef = useRef<number | null>(null);
  const fallbackFrameTimerRef = useRef<number | null>(null);
  const checkTimerRef = useRef<number | null>(null);
  const frameCallbackRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const previousVideoTimeRef = useRef(-1);
  const mismatchStreakRef = useRef(0);
  const resetSuggestionStreakRef = useRef(0);
  const checkIndexRef = useRef(0);
  const startPendingRef = useRef(false);
  const sessionGenerationRef = useRef(0);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
    canvasRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (healthTimerRef.current !== null) {
      window.clearInterval(healthTimerRef.current);
      healthTimerRef.current = null;
    }
    if (fallbackFrameTimerRef.current !== null) {
      window.clearInterval(fallbackFrameTimerRef.current);
      fallbackFrameTimerRef.current = null;
    }
    if (checkTimerRef.current !== null) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }
  }, []);

  const releaseResources = useCallback((reason: string, didFireEndedEvent = false) => {
    sessionGenerationRef.current += 1;
    clearTimers();
    clearCanvas();

    const video = videoRef.current;
    if (video && frameCallbackRef.current !== null && "cancelVideoFrameCallback" in video) {
      video.cancelVideoFrameCallback(frameCallbackRef.current);
    }
    frameCallbackRef.current = null;

    if (video) {
      video.pause();
      video.srcObject = null;
    }

    if (trackRef.current) {
      trackRef.current.onended = null;
    }
    const tracks = streamRef.current?.getTracks() ?? [];
    tracks.forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    videoRef.current = null;
    startPendingRef.current = false;
    setTrackReadyState("ended");
    setFreshFrame(false);
    setStatus("paused");
    setPauseMessage(reason || "Screen Check paused");
    if (didFireEndedEvent) {
      setEndedEventFired(true);
    }
  }, [clearCanvas, clearTimers]);

  const markFreshFrame = useCallback(() => {
    const receivedAt = Date.now();
    lastFrameAtRef.current = receivedAt;
    setLastFrameAt(receivedAt);
    setFreshFrame(true);
    if (trackRef.current?.readyState === "live") {
      setStatus("active");
      setTrackReadyState("live");
    }
  }, []);

  const watchVideoFrames = useCallback((video: HTMLVideoElement) => {
    const frameApi = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
    };

    if (typeof frameApi.requestVideoFrameCallback === "function") {
      const onFrame: VideoFrameRequestCallback = () => {
        if (videoRef.current !== video || trackRef.current?.readyState !== "live") {
          return;
        }
        markFreshFrame();
        frameCallbackRef.current = frameApi.requestVideoFrameCallback?.(onFrame) ?? null;
      };
      frameCallbackRef.current = frameApi.requestVideoFrameCallback(onFrame);
      return;
    }

    fallbackFrameTimerRef.current = window.setInterval(() => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== previousVideoTimeRef.current) {
        previousVideoTimeRef.current = video.currentTime;
        markFreshFrame();
      }
    }, 500);
  }, [markFreshFrame]);

  const reportCaptureError = useCallback((error: unknown) => {
    const details = getCaptureErrorDetails(error);
    console.warn("Screen Check capture failed", {
      name: details.name,
      message: details.message
    });
    clearTimers();
    clearCanvas();
    if (trackRef.current) {
      trackRef.current.onended = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    videoRef.current = null;
    startPendingRef.current = false;
    setTrackReadyState("none");
    setStatus("error");
    setErrorMessage(details.humanMessage);
    setLastErrorName(details.name);
    setLastErrorMessage(details.message);
  }, [clearCanvas, clearTimers]);

  const reportUnsupported = useCallback(() => {
    setBrowserSupported(false);
    setStatus("error");
    setErrorMessage("This browser does not support screen sharing. Try Chrome or Edge on desktop.");
    setLastErrorName("UnsupportedError");
    setLastErrorMessage("navigator.mediaDevices.getDisplayMedia is unavailable.");
  }, []);

  const acceptCaptureRequest = useCallback((captureRequest: Promise<MediaStream>) => {
    if (startPendingRef.current || status === "active" || status === "connecting") {
      return;
    }

    startPendingRef.current = true;
    const sessionGeneration = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = sessionGeneration;
    setPickerOpened(true);
    setStatus("requesting");
    setErrorMessage("");
    setLastErrorName("none");
    setLastErrorMessage("");
    setPauseMessage("");
    setTestMessage([]);
    setEndedEventFired(false);
    setTrackReadyState("none");
    setFreshFrame(false);
    lastFrameAtRef.current = null;
    setLastFrameAt(null);

    async function connectCapture() {
      try {
      const stream = await captureRequest;
      if (sessionGenerationRef.current !== sessionGeneration) {
        stream.getTracks().forEach((item) => item.stop());
        return;
      }
      const videoTracks = stream.getVideoTracks();
      const track = videoTracks.length === 1 ? videoTracks[0] : null;

      if (!track || track.readyState !== "live") {
        stream.getTracks().forEach((item) => item.stop());
        throw new DOMException("The browser did not return exactly one live video track.", "NotFoundError");
      }

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      streamRef.current = stream;
      trackRef.current = track;
      videoRef.current = video;
      startedAtRef.current = Date.now();
      setTrackReadyState(track.readyState);
      setStatus("connecting");

      track.onended = () => {
        if (trackRef.current !== track) {
          return;
        }
        releaseResources("Screen Check paused because browser sharing ended.", true);
      };

      await video.play();
      if (track.readyState !== "live") {
        throw new DOMException("The screen track ended before playback started.", "NotFoundError");
      }
      setStatus("active");
      watchVideoFrames(video);

      healthTimerRef.current = window.setInterval(() => {
        const currentTrack = trackRef.current;
        const now = Date.now();
        const frameAt = lastFrameAtRef.current;
        const startedAt = startedAtRef.current ?? now;

        if (!currentTrack || currentTrack.readyState === "ended") {
          setTrackReadyState("ended");
          releaseResources("Screen Check paused because the screen track ended.");
          return;
        }

        setTrackReadyState(currentTrack.readyState);
        const isFresh = frameAt !== null && now - frameAt <= FRESH_FRAME_LIMIT_MS;
        setFreshFrame(isFresh);
        if ((frameAt === null && now - startedAt > FRESH_FRAME_LIMIT_MS) || (frameAt !== null && !isFresh)) {
          releaseResources("Screen Check paused because no fresh frame arrived for 15 seconds.");
        }
      }, 1000);
      } catch (error) {
        reportCaptureError(error);
      } finally {
        startPendingRef.current = false;
      }
    }

    void connectCapture();
  }, [releaseResources, reportCaptureError, status, watchVideoFrames]);

  useEffect(() => {
    setBrowserSupported(Boolean(navigator.mediaDevices?.getDisplayMedia));
  }, []);

  const drawCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    const track = trackRef.current;
    const frameAt = lastFrameAtRef.current;

    if (!video || !track || track.readyState !== "live" || !frameAt || Date.now() - frameAt > FRESH_FRAME_LIMIT_MS) {
      throw new Error("A fresh screen frame is not available.");
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("The screen frame is not ready yet.");
    }

    const scale = Math.min(320 / sourceWidth, 180 / sourceHeight, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("The private frame sampler is unavailable.");
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvasRef.current = canvas;
    return canvas;
  }, []);

  const test = useCallback(() => {
    try {
      drawCurrentFrame();
      setTestMessage(["Screen connected", "Fresh frame received", "Private checks are ready"]);
    } catch (error) {
      setTestMessage([error instanceof Error ? error.message : "A fresh frame was not available."]);
    } finally {
      clearCanvas();
    }
  }, [clearCanvas, drawCurrentFrame]);

  const applyFairnessRule = useCallback((alignment: CloudResult["alignment"]) => {
    let result: ScreenCheckPrivateResult;

    if (alignment === "aligned") {
      mismatchStreakRef.current = 0;
      resetSuggestionStreakRef.current = 0;
      result = {
        kind: "aligned",
        title: "Still aligned",
        message: "Keep going. Finish your next small step before switching tasks."
      };
    } else if (alignment === "likely_mismatch") {
      mismatchStreakRef.current += 1;
      if (mismatchStreakRef.current >= 2) {
        resetSuggestionStreakRef.current += 1;
        result = {
          kind: "reset_suggested",
          title: "Reset suggested",
          message: "Choose one action you can finish in five minutes."
        };
      } else {
        resetSuggestionStreakRef.current = 0;
        result = {
          kind: "unclear",
          title: "Quick self-check",
          message: "Your screen may not match your current goal. What is your next step?"
        };
      }
    } else {
      mismatchStreakRef.current = 0;
      resetSuggestionStreakRef.current = 0;
      result = {
        kind: "unclear",
        title: "Quick self-check",
        message: "Your screen may not match your current goal. What is your next step?"
      };
    }

    setConsecutiveResetSuggestions(resetSuggestionStreakRef.current);
    setPrivateResult(result);
    setLastResult(result.kind);
    setLastPrivateCheckAt(Date.now());
  }, []);

  const runPrivateCheck = useCallback(async () => {
    let canvas: HTMLCanvasElement | null = null;
    let usedMode: AnalysisMode = "local";

    try {
      canvas = drawCurrentFrame();
      let alignment = getLocalAlignment(options.activityCategory, options.privateFocusCheckState, options.expectedContexts);

      if (analysisMode === "cloud" && cloudAvailable) {
        const frameDataUrl = canvas.toDataURL("image/jpeg", 0.58);
        clearCanvas();
        canvas = null;

        const response = await fetch("/api/screen-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: options.goal,
            subject: options.subject,
            expectedContexts: options.expectedContexts,
            frameDataUrl
          }),
          cache: "no-store"
        });

        if (response.ok) {
          const result = await response.json() as CloudResult;
          alignment = result.alignment;
          usedMode = "cloud";
        }
      }

      setLastAnalysisMode(usedMode);
      applyFairnessRule(alignment);
    } catch {
      setPrivateResult({
        kind: "unclear",
        title: "Check paused",
        message: "A fresh frame was not available. Your screen was not analyzed."
      });
      setLastResult("unclear");
    } finally {
      if (canvas) {
        clearCanvas();
      }
    }
  }, [analysisMode, applyFairnessRule, clearCanvas, cloudAvailable, drawCurrentFrame, options.activityCategory, options.expectedContexts, options.goal, options.privateFocusCheckState, options.subject]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/screen-check", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ cloudAvailable: boolean }> : null)
      .then((result) => {
        if (!cancelled) {
          setCloudAvailable(Boolean(result?.cloudAvailable));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCloudAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (options.pauseRequested && (status === "active" || status === "connecting" || status === "requesting")) {
      releaseResources(options.pauseReason);
    }
  }, [options.pauseReason, options.pauseRequested, releaseResources, status]);

  useEffect(() => {
    if (checkTimerRef.current !== null) {
      window.clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    if (
      status !== "active" ||
      !freshFrame ||
      !options.isFocusPhase ||
      options.focusCheckOpen ||
      options.pauseRequested ||
      !options.goal.trim() ||
      options.expectedContexts.length === 0
    ) {
      return;
    }

    const delay = CHECK_DELAYS_MS[checkIndexRef.current % CHECK_DELAYS_MS.length];
    checkTimerRef.current = window.setTimeout(() => {
      checkIndexRef.current += 1;
      void runPrivateCheck().finally(() => setScheduleVersion((value) => value + 1));
    }, delay);

    return () => {
      if (checkTimerRef.current !== null) {
        window.clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [freshFrame, options.expectedContexts.length, options.focusCheckOpen, options.goal, options.isFocusPhase, options.pauseRequested, runPrivateCheck, scheduleVersion, status]);

  useEffect(() => () => {
    sessionGenerationRef.current += 1;
    clearTimers();
    clearCanvas();
    const video = videoRef.current;
    if (video && frameCallbackRef.current !== null && "cancelVideoFrameCallback" in video) {
      video.cancelVideoFrameCallback(frameCallbackRef.current);
    }
    video?.pause();
    if (video) {
      video.srcObject = null;
    }
    if (trackRef.current) {
      trackRef.current.onended = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    trackRef.current = null;
    videoRef.current = null;
  }, [clearCanvas, clearTimers]);

  return {
    status,
    trackReadyState,
    endedEventFired,
    lastFrameAt,
    lastPrivateCheckAt,
    lastResult,
    privateResult,
    freshFrame,
    testMessage,
    errorMessage,
    lastErrorName,
    lastErrorMessage,
    browserSupported,
    pickerOpened,
    pauseMessage,
    cloudAvailable,
    analysisMode,
    lastAnalysisMode,
    consecutiveResetSuggestions,
    acceptCaptureRequest,
    reportCaptureError,
    reportUnsupported,
    stop: () => releaseResources("Screen Check paused by you."),
    test,
    runPrivateCheck,
    useCloudAnalysis: () => setAnalysisMode("cloud"),
    useLocalAnalysis: () => setAnalysisMode("local")
  };
}

function getCaptureErrorDetails(error: unknown) {
  const name = typeof error === "object" && error && "name" in error && typeof error.name === "string"
    ? error.name
    : "UnknownError";
  const message = typeof error === "object" && error && "message" in error && typeof error.message === "string"
    ? error.message
    : String(error);

  const humanMessages: Record<string, string> = {
    NotAllowedError: "Screen sharing was cancelled or blocked by the browser.",
    InvalidStateError: "Click Enable Screen Check directly to start sharing.",
    NotFoundError: "No shareable screen, window, or tab was available."
  };

  return {
    name,
    message,
    humanMessage: humanMessages[name] ?? `${name}: ${message}`
  };
}

function getLocalAlignment(
  activityCategory: ActivityCategory | undefined,
  privateFocusCheckState: FocusCheckStoredState | null | undefined,
  expectedContexts: ScreenCheckExpectedContext[]
): CloudResult["alignment"] {
  if (privateFocusCheckState === "needs_reset") {
    return "likely_mismatch";
  }

  if (activityCategory === "idle") {
    return "likely_mismatch";
  }

  if (activityCategory === "social_media" && !expectedContexts.includes("class_group_chat")) {
    return "likely_mismatch";
  }

  if (privateFocusCheckState === "uncertain" || activityCategory === "unknown") {
    return "unclear";
  }

  return "aligned";
}
