"use client";

import { MonitorCheck, MonitorUp, ShieldCheck, Square } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useScreenCheckSession } from "@/hooks/useScreenCheckSession";
import type {
  ActivityCategory,
  FocusCheckStoredState,
  ScreenCheckExpectedContext
} from "@/lib/types";

type ScreenCheckPanelProps = {
  goal: string;
  subject: string;
  activityCategory: ActivityCategory;
  privateFocusCheckState: FocusCheckStoredState | null;
  focusCheckOpen: boolean;
  isFocusPhase: boolean;
  pauseRequested: boolean;
  pauseReason: string;
  judgeDemo: boolean;
  accountabilityOptedIn: boolean;
  participantCount: number;
  activeParticipantCount: number;
  optedInCount: number;
  pulseCooldownActive: boolean;
  onAccountabilityOptInChange: (nextValue: boolean) => Promise<void> | void;
  onAccountabilityPulse: (source: "private_resets" | "explicit") => Promise<string>;
};

export type ScreenCheckHandle = {
  stop(): Promise<void>;
  isActive(): boolean;
};

const contextOptions: Array<{ value: ScreenCheckExpectedContext; label: string }> = [
  { value: "writing_notes", label: "Writing or notes" },
  { value: "research_pages", label: "Research pages" },
  { value: "calculator_coding", label: "Calculator or coding tools" },
  { value: "video_lecture", label: "Video lecture" },
  { value: "class_group_chat", label: "Class group chat" }
];

export const ScreenCheckPanel = forwardRef<ScreenCheckHandle, ScreenCheckPanelProps>(function ScreenCheckPanel(props, ref) {
  const [expectedContexts, setExpectedContexts] = useState<ScreenCheckExpectedContext[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [pulseMessage, setPulseMessage] = useState("");
  const session = useScreenCheckSession({
    goal: props.goal,
    subject: props.subject,
    expectedContexts,
    activityCategory: props.activityCategory,
    privateFocusCheckState: props.privateFocusCheckState,
    focusCheckOpen: props.focusCheckOpen,
    isFocusPhase: props.isFocusPhase,
    pauseRequested: props.pauseRequested,
    pauseReason: props.pauseReason
  });

  useImperativeHandle(ref, () => ({
    async stop() {
      session.stop();
    },
    isActive() {
      return session.status === "active";
    }
  }), [session]);

  const inactive = session.status === "idle" || session.status === "paused" || session.status === "error";
  const pulseGateOpen =
    props.participantCount >= 3 &&
    props.activeParticipantCount >= 3 &&
    props.optedInCount === props.participantCount &&
    props.isFocusPhase &&
    !props.pulseCooldownActive;

  function toggleContext(context: ScreenCheckExpectedContext) {
    setExpectedContexts((current) => current.includes(context)
      ? current.filter((item) => item !== context)
      : [...current, context]);
  }

  async function requestPulse(source: "private_resets" | "explicit") {
    if (!pulseGateOpen) {
      setPulseMessage(getPulseGateMessage(props));
      return;
    }

    setPulseMessage(await props.onAccountabilityPulse(source));
  }

  if (dismissed && session.status === "idle") {
    return (
      <div className="mt-5 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">Screen Check</p>
            <p className="mt-1 text-xs text-muted">Optional and currently off.</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(false)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
          >
            Review option
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-border pt-5">
      <div className="flex items-start gap-3">
        <MonitorCheck aria-hidden="true" className="mt-0.5 shrink-0 text-focus" size={20} />
        <div>
          <p className="text-sm font-semibold text-primary">Optional Screen Check</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Share your screen for this focus block to receive private on-task reminders.
          </p>
        </div>
      </div>

      {inactive && (
        <div className="mt-4 space-y-4">
          <p className="border-l-2 border-break pl-3 text-sm leading-6 text-primary">
            Choose Entire Screen if you want checks to continue while switching between study apps. No images are saved or shown to your room.
          </p>

          <fieldset>
            <legend className="text-sm font-semibold text-primary">What may appear while you study?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {contextOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary transition hover:bg-surfaceHover">
                  <input
                    type="checkbox"
                    checked={expectedContexts.includes(option.value)}
                    onChange={() => toggleContext(option.value)}
                    className="h-4 w-4 accent-[var(--focus-accent)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="border-y border-border py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" size={17} className="text-muted" />
              <p className="text-sm font-semibold text-primary">Analysis mode</p>
            </div>
            {session.cloudAvailable ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-6 text-muted">
                  <strong className="text-primary">Private AI screen analysis:</strong> a low-resolution frame may be sent to our AI provider for one-time analysis. Soryvo does not save the frame or show it to your room.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={session.useCloudAnalysis}
                    className={session.analysisMode === "cloud" ? "rounded-lg bg-focus px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-surfaceHover"}
                  >
                    Allow private AI analysis
                  </button>
                  <button
                    type="button"
                    onClick={session.useLocalAnalysis}
                    className={session.analysisMode === "local" ? "rounded-lg bg-break px-3 py-2 text-sm font-semibold text-primary" : "rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-surfaceHover"}
                  >
                    Keep checks on-device
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted">
                <strong className="text-primary">Local heuristic mode.</strong> No vision API is configured. Soryvo uses only your goal, expected contexts, private Focus Check state, and optional broad activity category.
              </p>
            )}
          </div>

          {session.pauseMessage && <p className="text-sm font-medium text-muted">{session.pauseMessage}</p>}
          {session.errorMessage && <p className="text-sm font-medium text-alert">{session.errorMessage}</p>}
          {session.lastErrorName !== "none" && (
            <div className="border-l-2 border-alert pl-3 text-xs leading-5 text-muted" role="status">
              <p className="font-semibold text-primary">Developer diagnostics</p>
              <p>Error name: {session.lastErrorName}</p>
              <p>Error message: {session.lastErrorMessage || "No browser message provided."}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (!navigator.mediaDevices?.getDisplayMedia) {
                  session.reportUnsupported();
                  return;
                }

                try {
                  const captureRequest = navigator.mediaDevices.getDisplayMedia({
                    video: {
                      frameRate: { ideal: 2, max: 5 }
                    },
                    audio: false
                  });
                  session.acceptCaptureRequest(captureRequest);
                } catch (error) {
                  session.reportCaptureError(error);
                }
              }}
              disabled={expectedContexts.length === 0 || session.status === "requesting" || props.pauseRequested}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MonitorUp aria-hidden="true" size={18} />
              Enable Screen Check
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {(session.status === "requesting" || session.status === "connecting") && (
        <div className="mt-4 border-l-2 border-focus pl-3">
          <p className="font-semibold text-primary">Screen Check: Connecting</p>
          <p className="mt-1 text-sm text-muted">Waiting for a live screen track and the first fresh frame.</p>
        </div>
      )}

      {session.status === "active" && (
        <div className="mt-4 space-y-4">
          <div className="border-l-2 border-focus pl-3">
            <p className="font-semibold text-primary">Screen Check: Active</p>
            <p className="mt-1 text-sm text-muted">Entire screen recommended</p>
            <p className="mt-1 text-sm text-muted">Last private check: {formatTimestamp(session.lastPrivateCheckAt, "Not run yet")}</p>
            <p className="mt-1 text-xs text-muted">
              {session.analysisMode === "cloud" ? "Cloud vision mode" : "Local heuristic mode"}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={session.test} className="rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
              Test Screen Check
            </button>
            <button type="button" onClick={session.stop} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
              <Square aria-hidden="true" size={16} />
              Stop Screen Check
            </button>
          </div>

          {session.testMessage.length > 0 && (
            <div className="border-l-2 border-focus pl-3 text-sm leading-6 text-primary" role="status">
              {session.testMessage.map((message) => <p key={message}>{message}</p>)}
            </div>
          )}

          {session.privateResult && (
            <div className="border-y border-border py-4" role="status">
              <p className="font-semibold text-primary">{session.privateResult.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{session.privateResult.message}</p>
              <p className="mt-2 text-xs text-muted">Private result. This is not shown to your room.</p>
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="flex items-start gap-2">
              <input
                id="accountability-pulse-opt-in"
                type="checkbox"
                checked={props.accountabilityOptedIn}
                onChange={(event) => void props.onAccountabilityOptInChange(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--focus-accent)]"
              />
              <label htmlFor="accountability-pulse-opt-in" className="text-sm leading-6 text-muted">
                <strong className="text-primary">Join Accountability Pulse.</strong> Allow anonymous 90-second lock-in invitations only when everyone in the room opts in.
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">{props.optedInCount} of {props.participantCount} room members opted in.</p>
            <button
              type="button"
              onClick={() => void requestPulse("explicit")}
              className="mt-3 w-full rounded-lg bg-break px-4 py-3 font-semibold text-primary transition hover:bg-breakDark"
            >
              I need a reset
            </button>
            {session.consecutiveResetSuggestions >= 2 && (
              <button
                type="button"
                onClick={() => void requestPulse("private_resets")}
                className="mt-2 w-full rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover"
              >
                Invite an anonymous 90-second lock-in
              </button>
            )}
            {pulseMessage && <p className="mt-2 text-sm leading-6 text-muted" role="status">{pulseMessage}</p>}
          </div>
        </div>
      )}

      <p className="mt-3 font-mono text-[11px] leading-5 text-muted" aria-live="polite">
        Browser supported: {session.browserSupported ? "yes" : "no"} | Picker opened: {session.pickerOpened ? "yes" : "no"} | Track: {session.trackReadyState === "live" ? "live" : "ended"} | Last error: {session.lastErrorName}
      </p>

      {props.judgeDemo && session.status !== "idle" && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-primary">Screen Check test panel</p>
            {session.status === "active" && (
              <button type="button" onClick={() => void session.runPrivateCheck()} className="text-xs font-semibold text-focus hover:text-focusDark">
                Run private check now
              </button>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted">Capture status:</dt><dd className="font-mono text-primary">{session.status === "active" ? "active" : "paused"}</dd>
            <dt className="text-muted">Track state:</dt><dd className="font-mono text-primary">{session.trackReadyState === "live" ? "live" : "ended"}</dd>
            <dt className="text-muted">Fresh frame:</dt><dd className="font-mono text-primary">{session.freshFrame ? "yes" : "no"}</dd>
            <dt className="text-muted">Last frame received:</dt><dd className="font-mono text-primary">{formatTimestamp(session.lastFrameAt, "none")}</dd>
            <dt className="text-muted">Last private check:</dt><dd className="font-mono text-primary">{formatTimestamp(session.lastPrivateCheckAt, "none")}</dd>
            <dt className="text-muted">Last result:</dt><dd className="font-mono text-primary">{session.lastResult.replace("_", " ")}</dd>
            <dt className="text-muted">Ended event fired:</dt><dd className="font-mono text-primary">{session.endedEventFired ? "yes" : "no"}</dd>
            <dt className="text-muted">Last analysis mode:</dt><dd className="font-mono text-primary">{session.lastAnalysisMode}</dd>
          </dl>
        </div>
      )}
    </div>
  );
});

function formatTimestamp(value: number | null, fallback: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : fallback;
}

function getPulseGateMessage(props: ScreenCheckPanelProps) {
  if (props.participantCount < 3 || props.activeParticipantCount < 3) {
    return "Accountability Pulse needs at least three active room members.";
  }
  if (props.optedInCount !== props.participantCount) {
    return "The pulse stays private until every current room member opts in.";
  }
  if (!props.isFocusPhase) {
    return "Accountability Pulse is available only during a focus phase.";
  }
  if (props.pulseCooldownActive) {
    return "The room already received a pulse in the last ten minutes.";
  }
  return "Your reset stays private.";
}
