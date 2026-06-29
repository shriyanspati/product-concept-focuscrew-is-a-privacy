"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock3,
  Copy,
  Pause,
  Play,
  ShieldCheck,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConsentScreen } from "@/components/ConsentScreen";
import { BreakLounge, type BreakLoungeHandle } from "@/components/BreakLounge";
import { EndSessionReport } from "@/components/EndSessionReport";
import { PrivacyDetailsModal } from "@/components/PrivacyDetailsModal";
import { SoryvoLogo } from "@/components/SoryvoLogo";
import { useLiveRoom } from "@/hooks/useLiveRoom";
import { useSyncedPomodoro } from "@/hooks/useSyncedPomodoro";
import { initialFocusHistory, seededMembers } from "@/lib/demoData";
import {
  endBreak,
  endRoom,
  insertLiveRoomEvent,
  leaveLiveRoom,
  liveRoomsAvailable,
  startBreak,
  startPomodoro,
  updateLiveParticipantStatus,
} from "@/lib/liveRoomApi";
import { localRoomAdapter } from "@/lib/storageAdapter";
import { getSupabaseBrowserClient, isLiveRoomSession } from "@/lib/supabaseClient";
import type {
  ActivitySignal,
  FocusPoint,
  MemberStatus,
  ParticipantStatus,
  RoomConfig,
  RoomPhase,
  RoomMember,
  SessionReport
} from "@/lib/types";

type StudyRoomProps = {
  roomCode: string;
};

const defaultConfig = (roomCode: string): RoomConfig => ({
  displayName: "Guest",
  subject: "AP Biology",
  duration: 25,
  goal: "Review photosynthesis notes and finish a five-question check",
  roomCode,
  judgeDemo: roomCode === "CREW42",
  consentAccepted: false,
  mode: roomCode === "CREW42" ? "demo" : liveRoomsAvailable() ? "live" : "local"
});

export function StudyRoom({ roomCode }: StudyRoomProps) {
  const router = useRouter();
  const [config, setConfig] = useState<RoomConfig>(() => defaultConfig(roomCode));
  const [ready, setReady] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>(seededMembers);
  const [groupFocusScore, setGroupFocusScore] = useState(84);
  const [focusHistory, setFocusHistory] = useState<FocusPoint[]>(initialFocusHistory);
  const [recentSignals, setRecentSignals] = useState<ActivitySignal[]>(["focused"]);
  const [, setSelectedSignal] = useState<ActivitySignal>("focused");
  const [focusedMinutes, setFocusedMinutes] = useState(14);
  const [recoveryMoments, setRecoveryMoments] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [localPhase, setLocalPhase] = useState<"focus" | "break">("focus");
  const [entryCountdown, setEntryCountdown] = useState(3);
  const [roomEntryComplete, setRoomEntryComplete] = useState(false);
  const [sharingPaused, setSharingPaused] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [resetActive, setResetActive] = useState(false);
  const [inviteJoinRequired, setInviteJoinRequired] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinGoal, setJoinGoal] = useState("");
  const [joinSubject, setJoinSubject] = useState("Study Session");
  const [joiningLiveRoom, setJoiningLiveRoom] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [endSessionError, setEndSessionError] = useState("");
  const [remoteSessionEnded, setRemoteSessionEnded] = useState(false);
  const endingSessionRef = useRef(false);
  const breakLoungeRef = useRef<BreakLoungeHandle | null>(null);
  const localCountdownIntervalRef = useRef<number | null>(null);
  const entryCountdownIntervalRef = useRef<number | null>(null);
  const autoStartAttemptedRef = useRef(false);

  const liveEnabled = ready && config.consentAccepted && config.mode === "live" && !config.judgeDemo && !isEndingSession;
  const liveRoom = useLiveRoom({ roomCode, config, enabled: liveEnabled });
  const isLiveCreator = Boolean(
    liveRoom.snapshot?.room.createdByUserId &&
    liveRoom.snapshot.currentParticipant.userId === liveRoom.snapshot.room.createdByUserId
  );
  const handlePomodoroExpired = useCallback(async (phase: RoomPhase) => {
    if (endingSessionRef.current || !liveRoom.snapshot || !isLiveCreator) {
      return;
    }

    try {
      if (phase === "focus") {
        await startBreak(liveRoom.snapshot.room.id);
      }

      if (phase === "break") {
        await endBreak(liveRoom.snapshot.room.id);
      }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Shared timer could not advance.");
    }
  }, [isLiveCreator, liveRoom.snapshot]);
  const syncedPomodoro = useSyncedPomodoro({
    room: liveRoom.snapshot?.room,
    isCreator: isLiveCreator,
    onPhaseExpired: handlePomodoroExpired,
    disabled: isEndingSession
  });

  useEffect(() => {
    if (!ready || !config.consentAccepted || roomEntryComplete || isEndingSession) {
      return;
    }

    setEntryCountdown(3);
    entryCountdownIntervalRef.current = window.setInterval(() => {
      setEntryCountdown((count) => {
        if (count <= 1) {
          if (entryCountdownIntervalRef.current !== null) {
            window.clearInterval(entryCountdownIntervalRef.current);
            entryCountdownIntervalRef.current = null;
          }
          setRoomEntryComplete(true);
          return 0;
        }

        return count - 1;
      });
    }, 1000);

    return () => {
      if (entryCountdownIntervalRef.current !== null) {
        window.clearInterval(entryCountdownIntervalRef.current);
        entryCountdownIntervalRef.current = null;
      }
    };
  }, [config.consentAccepted, isEndingSession, ready, roomEntryComplete]);

  useEffect(() => {
    if (
      !roomEntryComplete ||
      config.mode !== "live" ||
      !liveRoom.snapshot ||
      !isLiveCreator ||
      liveRoom.snapshot.room.phase !== "lobby" ||
      autoStartAttemptedRef.current
    ) {
      return;
    }

    autoStartAttemptedRef.current = true;
    void startPomodoro(liveRoom.snapshot.room.id).catch((error) => {
      autoStartAttemptedRef.current = false;
      setJoinError(error instanceof Error ? error.message : "The focus timer could not start automatically.");
    });
  }, [config.mode, isLiveCreator, liveRoom.snapshot, roomEntryComplete]);

  useEffect(() => {
    const savedConfig = localRoomAdapter.loadRoomConfig(roomCode);

    if (!savedConfig && roomCode !== "CREW42" && liveRoomsAvailable()) {
      setConfig({
        ...defaultConfig(roomCode),
        roomCode,
        mode: "live",
        judgeDemo: false,
        consentAccepted: false
      });
      setInviteJoinRequired(true);
      setReady(true);
      return;
    }

    const nextConfig = savedConfig ?? defaultConfig(roomCode);
    const currentUser: RoomMember = {
      id: "current",
      name: nextConfig.displayName || "You",
      goal: nextConfig.goal,
      status: "focused",
      sharing: true,
      accountabilityPulseOptIn: false
    };

    setConfig(nextConfig);
    setMembers(nextConfig.judgeDemo || nextConfig.mode === "demo" ? [currentUser, ...seededMembers] : [currentUser]);
    setSecondsRemaining(nextConfig.duration * 60);
    setReady(true);
  }, [roomCode]);

  useEffect(() => {
    if (!inviteJoinRequired || !liveRoomsAvailable() || joinName.trim()) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;

    async function loadDisplayName() {
      const { data } = await supabaseClient.auth.getSession();
      const metadataName = data.session?.user.user_metadata?.display_name;

      if (!cancelled && isLiveRoomSession(data.session) && typeof metadataName === "string") {
        setJoinName(metadataName);
      }
    }

    void loadDisplayName();

    return () => {
      cancelled = true;
    };
  }, [inviteJoinRequired, joinName]);

  const groupDriftCount = useMemo(
    () => members.filter((member) => member.status === "needs_reset").length,
    [members]
  );

  const recoveryCardVisible = groupDriftCount >= 2 || groupFocusScore < 55;

  useEffect(() => {
    if (!liveRoom.snapshot) {
      return;
    }

    const snapshot = liveRoom.snapshot;
    setMembers(snapshot.participants.map((participant) => ({
      id: participant.id,
      name: participant.displayName,
      goal: participant.goal,
      status: participant.status,
      sharing: participant.status !== "not_sharing_activity",
      accountabilityPulseOptIn: participant.accountabilityPulseOptIn
    })));
    setConfig((current) => ({
      ...current,
      roomCode: snapshot.room.roomCode,
      duration: snapshot.room.sessionDurationMinutes,
      liveRoomId: snapshot.room.id,
      liveParticipantId: snapshot.currentParticipant.id,
      isHost: snapshot.currentParticipant.userId === snapshot.room.createdByUserId,
      mode: "live"
    }));

    const nextScore = calculateGroupFocusScore(snapshot.participants.map((participant) => participant.status));
    if (nextScore !== null) {
      setGroupFocusScore(nextScore);
      setFocusHistory((history) => {
        const previous = history.at(-1);
        if (previous?.score === nextScore) {
          return history;
        }

        return [
          ...history,
          {
            minute: (previous?.minute ?? 0) + 3,
            score: nextScore
          }
        ];
      });
    }

    if (snapshot.room.phase === "break") {
      setSelectedSignal("need_break");
    }
  }, [liveRoom.snapshot]);

  useEffect(() => {
    if (!ready || !config.consentAccepted || !roomEntryComplete || showReport || isEndingSession) {
      return;
    }

    if (config.mode === "live") {
      return;
    }

    localCountdownIntervalRef.current = window.setInterval(() => {
      setSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          if (localCountdownIntervalRef.current !== null) {
            window.clearInterval(localCountdownIntervalRef.current);
            localCountdownIntervalRef.current = null;
          }
          if (localPhase === "focus") {
            setLocalPhase("break");
            setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "taking_break" : "not_sharing_activity" })));
            return 5 * 60;
          }

          setLocalPhase("focus");
          setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "focused" : "not_sharing_activity" })));
          return config.duration * 60;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => {
      if (localCountdownIntervalRef.current !== null) {
        window.clearInterval(localCountdownIntervalRef.current);
        localCountdownIntervalRef.current = null;
      }
    };
  }, [config.consentAccepted, config.duration, config.mode, isEndingSession, localPhase, ready, roomEntryComplete, showReport]);

  useEffect(() => {
    if (liveRoom.snapshot?.room.phase === "ended" && !endingSessionRef.current) {
      endingSessionRef.current = true;
      setIsEndingSession(true);
      setRemoteSessionEnded(true);
      localRoomAdapter.clearRoomConfig(config.roomCode);
    }
  }, [config.roomCode, liveRoom.snapshot?.room.phase]);

  async function acceptConsent() {
    setJoiningLiveRoom(true);
    setJoinError("");

    try {
      if (config.mode === "live" && !config.liveParticipantId) {
        const snapshot = await import("@/lib/liveRoomApi").then(({ joinLiveRoom }) =>
          joinLiveRoom({
            roomCode: config.roomCode,
            displayName: config.displayName || "Guest",
            goal: config.goal || "Finish one focused study task"
          })
        );
        const acceptedConfig = {
          ...config,
          roomCode: snapshot.room.roomCode,
          liveRoomId: snapshot.room.id,
          liveParticipantId: snapshot.currentParticipant.id,
          consentAccepted: true
        };
        setConfig(acceptedConfig);
        localRoomAdapter.saveRoomConfig(acceptedConfig);
        return;
      }

      const acceptedConfig = { ...config, consentAccepted: true };
      setConfig(acceptedConfig);
      localRoomAdapter.saveRoomConfig(acceptedConfig);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Could not join this live room.");
      setInviteJoinRequired(true);
    } finally {
      setJoiningLiveRoom(false);
    }
  }

  function simulate(signal: ActivitySignal) {
    setSelectedSignal(signal);
    setRecentSignals((signals) => [...signals.slice(-4), signal]);
    setResetActive(false);

    if (signal === "focused") {
      applyScore(88);
      setFocusedMinutes((minutes) => minutes + 2);
      setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "focused" : "not_sharing_activity" })));
    }

    if (signal === "task_switch") {
      applyScore(62);
      setMembers((current) =>
        current.map((member, index) =>
          index === 2 || index === 3 ? { ...member, status: "needs_reset" } : member
        )
      );
    }

    if (signal === "long_idle") {
      applyScore(52);
      setMembers((current) =>
        current.map((member, index) =>
          index === 0 || index === 4 ? { ...member, status: "needs_reset" } : member
        )
      );
    }

    if (signal === "group_drift") {
      applyScore(38);
      setMembers((current) =>
        current.map((member, index) =>
          index === 1 ? { ...member, status: "taking_break" } : index >= 2 ? { ...member, status: "needs_reset" } : member
        )
      );
    }

    if (signal === "back_on_track") {
      applyScore(86);
      setFocusedMinutes((minutes) => minutes + 4);
      setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "focused" : "not_sharing_activity" })));
      setResetActive(false);
    }

    if (signal === "need_break") {
      applyScore(58);
      setMembers((current) =>
        current.map((member, index) => index === 0 || index === 1 ? { ...member, status: "taking_break" } : member)
      );
    }

  }

  function applyScore(score: number) {
    setGroupFocusScore(score);
    setFocusHistory((history) => [
      ...history,
      {
        minute: history.at(-1)?.minute ? (history.at(-1)?.minute ?? 0) + 3 : 18,
        score
      }
    ]);
  }

  function startReset() {
    setRecoveryMoments((count) => count + 1);
    setResetActive(true);
    setSelectedSignal("reset_started");
    applyScore(57);
    if (config.mode !== "live") {
      setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "needs_reset" : "not_sharing_activity" })));
    }
    if (liveRoom.snapshot) {
      void insertLiveRoomEvent({ roomId: liveRoom.snapshot.room.id, eventType: "shared_reset_started" });
    }
  }

  function keepGoing() {
    setSelectedSignal("focused");
    applyScore(Math.max(groupFocusScore, 63));
  }

  function toggleSharing() {
    setSharingPaused((paused) => !paused);
    setMembers((current) =>
      current.map((member) =>
        member.id === "current"
          ? { ...member, sharing: sharingPaused, status: sharingPaused ? "focused" : "not_sharing_activity" }
          : member
      )
    );
    void updateCurrentPublicStatus(sharingPaused ? "focused" : "not_sharing_activity");
  }

  async function updateCurrentPublicStatus(status: ParticipantStatus) {
    setMembers((current) =>
      current.map((member) => member.id === "current" || member.id === config.liveParticipantId ? { ...member, status } : member)
    );

    if (liveRoom.snapshot?.currentParticipant.id) {
      try {
        await updateLiveParticipantStatus({
          participantId: liveRoom.snapshot.currentParticipant.id,
          status
        });
      } catch {
        setJoinError("Live status update could not sync. Your local room view is still usable.");
      }
    }
  }

  async function copyInviteLink() {
    if (config.mode !== "live") {
      setJoinError("Invite links are available for live Supabase rooms. This room is in Local Preview Mode.");
      return;
    }

    await window.navigator.clipboard.writeText(`${window.location.origin}/room/${config.roomCode}`);
    setJoinError("Invite link copied.");
  }

  async function disconnectBreakLounge() {
    console.log("[Soryvo] Cleanup: disconnecting Break Lounge");
    await breakLoungeRef.current?.disconnect();
    console.log("[Soryvo] Cleanup complete: Break Lounge");
  }

  async function unsubscribeRoom() {
    console.log("[Soryvo] Cleanup: unsubscribing room Realtime");
    await liveRoom.unsubscribeRoom();
    console.log("[Soryvo] Cleanup complete: room Realtime");
  }

  async function clearRoomTimers() {
    console.log("[Soryvo] Cleanup: clearing room timers");
    const intervalRefs = [localCountdownIntervalRef, entryCountdownIntervalRef];
    intervalRefs.forEach((timerRef) => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    });

    syncedPomodoro.clearTimer();
    console.log("[Soryvo] Cleanup complete: room timers");
  }

  async function endSession() {
    if (endingSessionRef.current) {
      return;
    }

    endingSessionRef.current = true;
    setIsEndingSession(true);
    setEndSessionError("");

    const roomId = liveRoom.snapshot?.room.id ?? config.liveRoomId ?? null;
    const isHost = config.mode !== "live" || isLiveCreator || config.isHost === true;
    const livekitConnected = breakLoungeRef.current?.isConnected() ?? false;

    console.log("[Soryvo] Ending session", {
      roomId,
      isHost,
      livekitConnected,
    });

    const diagnostics: string[] = [];
    const cleanupResults = await Promise.allSettled([
      disconnectBreakLounge(),
      unsubscribeRoom(),
      clearRoomTimers(),
    ]);

    cleanupResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const labels = ["Break Lounge", "Realtime", "room timers"];
        const message = `${labels[index]} cleanup failed: ${getErrorMessage(result.reason)}`;
        diagnostics.push(message);
        console.warn(`[Soryvo] ${message}`);
      }
    });

    try {
      if (config.mode === "live" && roomId) {
        if (isHost) {
          console.log("[Soryvo] Marking room ended", { roomId });
          await endRoom(roomId);
        } else {
          console.log("[Soryvo] Leaving room", { roomId });
          await leaveLiveRoom(roomId);
        }
      }
    } catch (error) {
      const message = `Database cleanup failed: ${getErrorMessage(error)}`;
      diagnostics.push(message);
      setEndSessionError(message);
      console.warn("[Soryvo] End session database step failed", error);
    }

    localRoomAdapter.clearRoomConfig(config.roomCode);
    window.sessionStorage.setItem("soryvo:end-session-result", isHost ? "host" : "participant");
    if (diagnostics.length > 0) {
      window.sessionStorage.setItem("soryvo:end-session-diagnostic", diagnostics.join("\n"));
    } else {
      window.sessionStorage.removeItem("soryvo:end-session-diagnostic");
    }

    router.replace("/room?ended=1");
    router.refresh();
  }

  async function submitInviteJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (liveRoomsAvailable()) {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

      if (!isLiveRoomSession(data.session)) {
        const params = new URLSearchParams();
        const nextName = joinName.trim();

        if (nextName) {
          params.set("name", nextName);
        }

        params.set("next", `/room/${roomCode}`);
        setJoinError("Sign in before joining a live room.");
        router.push(`/signin?${params.toString()}`);
        return;
      }
    }

    const nextConfig = {
      ...config,
      displayName: joinName.trim() || "Guest",
      subject: joinSubject.trim() || "Study Session",
      goal: joinGoal.trim() || "Finish one focused study task",
      roomCode,
      mode: "live" as const,
      judgeDemo: false,
      consentAccepted: false,
      isHost: false
    };
    setConfig(nextConfig);
    setInviteJoinRequired(false);
  }

  function buildReport(): SessionReport {
    const average = Math.round(focusHistory.reduce((sum, point) => sum + point.score, 0) / focusHistory.length);
    const maxPoint = focusHistory.reduce((max, point) => point.score > max.score ? point : max, focusHistory[0]);
    const lowSignals = recentSignals.filter((signal) => ["task_switch", "long_idle", "group_drift", "stuck"].includes(signal));
    const commonTrigger = lowSignals.includes("group_drift")
      ? "Group drift"
      : lowSignals.includes("long_idle")
        ? "Long idle time"
        : lowSignals.includes("task_switch")
          ? "Task switching"
          : "Broad next step";

    return {
      overallScore: average,
      focusedMinutes,
      recoveryMoments,
      strongestFocusPeriod: `Minute ${maxPoint.minute}`,
      commonTrigger,
      personalNote: `You protected ${focusedMinutes} focused minutes on ${config.goal}. The best recovery moments came when the next action was specific.`,
      nextSuggestion:
        "Your group recovered fastest when the next step was specific. Start your next session by defining the first five-minute action."
    };
  }

  function startAnotherSession() {
    setShowReport(false);
    setGroupFocusScore(84);
    setFocusHistory(initialFocusHistory);
    setRecentSignals(["focused"]);
    setSelectedSignal("focused");
    setFocusedMinutes(0);
    setRecoveryMoments(0);
    setSecondsRemaining(config.duration * 60);
    setResetActive(false);
    setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "focused" : "not_sharing_activity" })));
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 border-t border-border pt-6">
          <SoryvoLogo variant="mark" size={24} className="animate-pulse object-contain" />
          Preparing Soryvo...
        </div>
      </main>
    );
  }

  if (inviteJoinRequired) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-10">
        <form onSubmit={submitInviteJoin} className="w-full max-w-xl border-t border-border pt-6 sm:pt-8">
          <SoryvoLogo variant="mark" size={42} priority className="mb-5 object-contain" />
          <p className="text-sm font-medium text-muted">Live room invite</p>
          <h1 className="mt-2 text-3xl font-semibold">Join room {roomCode}</h1>
          <p className="mt-3 text-muted">
            Enter your own name and study goal before consenting to optional focus signals.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">Display name</span>
              <input
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">Subject or category</span>
              <input
                value={joinSubject}
                onChange={(event) => setJoinSubject(event.target.value)}
                placeholder="Chemistry"
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">Personal goal</span>
              <textarea
                value={joinGoal}
                onChange={(event) => setJoinGoal(event.target.value)}
                rows={3}
                placeholder="Finish one focused study task."
                className="w-full resize-none rounded-lg border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
              />
            </label>
          </div>
          {joinError && (
            <p className="mt-4 border-l-2 border-focus pl-3 text-sm text-primary">{joinError}</p>
          )}
          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark"
          >
            Continue to consent
          </button>
        </form>
      </main>
    );
  }

  if (!config.consentAccepted) {
    return <ConsentScreen onAccept={acceptConsent} busy={joiningLiveRoom} />;
  }

  if (remoteSessionEnded) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-10">
        <section className="w-full max-w-xl border-t border-border pt-8">
          <SoryvoLogo variant="mark" size={44} priority className="mb-5 object-contain" />
          <p className="text-sm font-medium text-muted">Room {config.roomCode}</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary">This study session has ended</h1>
          <p className="mt-3 leading-7 text-muted">The room host ended the session for everyone.</p>
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.setItem("soryvo:end-session-result", "host");
              router.replace("/room?ended=1");
              router.refresh();
            }}
            className="mt-6 rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark"
          >
            Return to rooms
          </button>
        </section>
      </main>
    );
  }

  if (!roomEntryComplete) {
    return (
      <main className="grid min-h-screen place-items-center px-5 py-10">
        <section className="w-full max-w-xl text-center">
          <SoryvoLogo variant="mark" size={48} priority className="mx-auto object-contain" />
          <p className="mt-6 text-sm font-medium text-muted">Joining room {config.roomCode}</p>
          <p className="mt-4 font-mono text-7xl font-semibold text-primary" aria-live="polite" aria-label={`${entryCountdown} seconds until focus starts`}>
            {entryCountdown}
          </p>
          <p className="mt-2 text-sm font-semibold uppercase text-muted">
            {entryCountdown === 3 ? "Three" : entryCountdown === 2 ? "Two" : "One"}
          </p>
          <h1 className="mt-5 text-3xl font-semibold text-primary">Your focus block starts automatically.</h1>
          <p className="mx-auto mt-3 max-w-md leading-7 text-muted">
            Work for {config.duration} minutes, then the room unlocks a five-minute break.
          </p>
        </section>
      </main>
    );
  }

  const focusLabel = getFocusLabel(groupFocusScore);
  const progress = config.mode === "live"
    ? syncedPomodoro.progress
    : Math.round(((config.duration * 60 - secondsRemaining) / (config.duration * 60)) * 100);
  const timerLabel = config.mode === "live" ? syncedPomodoro.remainingLabel : formatSeconds(secondsRemaining);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <header className="mx-auto mb-6 flex max-w-7xl flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Soryvo home">
          <SoryvoLogo variant="mark" size={32} priority className="object-contain" />
          <div>
            <p className="font-serif text-lg font-semibold">Soryvo</p>
            <p className="text-xs text-muted">Room {config.roomCode}</p>
          </div>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <RoomConnectionIndicator mode={config.mode ?? "local"} connectionState={liveRoom.connectionState} />
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm">
            <Clock3 aria-hidden="true" size={16} />
            {timerLabel}
          </div>
          {config.mode === "live" && (
            <button
              type="button"
              onClick={copyInviteLink}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
            >
              <Copy aria-hidden="true" size={16} />
              Copy Invite Link
            </button>
          )}
          <button
            type="button"
            onClick={() => setScriptOpen(true)}
            className="rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
          >
            Demo Script
          </button>
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="rounded-control border border-border p-2 text-primary transition hover:bg-surfaceHover"
            aria-label="View privacy details"
            title="View privacy details"
          >
            <ShieldCheck aria-hidden="true" size={19} />
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={isEndingSession}
            className="rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-break disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEndingSession ? "Ending session…" : "End Session"}
          </button>
          <button
            type="button"
            onClick={() => void endSession()}
            disabled={isEndingSession}
            className="rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEndingSession ? "Leaving…" : "Leave Room"}
          </button>
        </div>
      </header>

      <div className="mx-auto mb-5 max-w-7xl space-y-2">
        {config.mode === "local" && (
          <p className="border-l-2 border-border pl-3 text-sm text-muted">
            Local Preview Mode: live rooms need Supabase setup. The sample room is available now.
          </p>
        )}
        {liveRoom.error && (
          <p className="border-l-2 border-focus pl-3 text-sm text-primary">
            {liveRoom.error}
          </p>
        )}
        {joinError && (
          <p className="border-l-2 border-border pl-3 text-sm text-muted">
            {joinError}
          </p>
        )}
        {process.env.NODE_ENV !== "production" && endSessionError && (
          <p className="border-l-2 border-alert pl-3 font-mono text-xs text-alert">
            End session diagnostic: {endSessionError}
          </p>
        )}
      </div>

      <div className="mx-auto max-w-6xl">
        <section className="space-y-5">
          {(config.mode !== "live" || liveRoom.snapshot) && (
            <SharedPomodoroPanel
              phase={config.mode === "live" ? syncedPomodoro.phase : localPhase}
              label={config.mode === "live" ? syncedPomodoro.label : localPhase === "focus" ? "Focus session" : "Five-minute break"}
              remainingLabel={timerLabel}
              progress={progress}
              cycleNumber={config.mode === "live" ? syncedPomodoro.cycleNumber : 1}
              isRunning={config.mode === "live" ? syncedPomodoro.isRunning : true}
            />
          )}

          <div className="grid gap-5 xl:grid-cols-[0.72fr_1fr]">
            <section className="border-b border-border pb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">Shared focus</p>
                  <h1 className="mt-2 text-2xl font-semibold">{focusLabel}</h1>
                  <p className="mt-2 text-sm text-muted">Anonymous group trend. No individual callouts.</p>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-end justify-between gap-5">
                  <div>
                    <p className="text-6xl font-semibold leading-none">{groupFocusScore}</p>
                    <p className="mt-2 text-sm text-muted">Group focus score</p>
                  </div>
                  <p className="max-w-40 text-right text-sm leading-6 text-muted">Based on broad room statuses only.</p>
                </div>
                <div className="mt-5 h-2 rounded-small bg-surfaceMuted">
                  <div
                    className="h-full rounded-small bg-focus transition-[width] duration-200"
                    style={{ width: `${Math.max(0, Math.min(100, groupFocusScore))}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="border-b border-border pb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">Group</p>
                  <h2 className="mt-2 text-2xl font-semibold">Crew flow</h2>
                </div>
                <button
                  type="button"
                  onClick={toggleSharing}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition hover:bg-surfaceHover"
                  title="Pause or resume your own opt-in activity sharing"
                >
                  {sharingPaused ? <Play aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
                  {sharingPaused ? "Resume Sharing" : "Pause Sharing"}
                </button>
              </div>

              <div className="mt-5 divide-y divide-border border-y border-border">
                {members.map((member) => (
                  <div key={member.id} className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="mt-1 text-sm text-muted">{member.goal}</p>
                      </div>
                      <StatusPill status={member.status} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <AnimatePresence>
            {recoveryCardVisible && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="border-y border-border bg-redSoft/50 py-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm text-muted">Anonymous group recovery</p>
                    <h2 className="mt-2 text-2xl font-semibold">Focus dip detected.</h2>
                    <p className="mt-2 text-muted">Want to start a three-minute group lock-in? Soryvo never names who caused the dip.</p>
                    {resetActive && (
                      <p className="mt-3 border-l-2 border-focus pl-3 text-sm text-primary">
                        Reset prompt: one quiet minute, one tiny next step, then a group check-in.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={startReset} className="rounded-lg bg-focus px-4 py-3 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-focusDark">
                      Start 3-Minute Reset
                    </button>
                    <button type="button" onClick={keepGoing} className="rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
                      Keep Going
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <BreakLounge
            ref={breakLoungeRef}
            open={config.mode === "live" ? liveRoom.snapshot?.room.phase === "break" : localPhase === "break"}
            roomId={liveRoom.snapshot?.room.id}
            displayName={config.displayName}
            demoMode={config.judgeDemo}
          />

          {config.judgeDemo && (
            <section className="border-t border-border pt-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted">Sample room</p>
                  <h2 className="mt-2 text-xl font-semibold">Activity Signal Simulator</h2>
                </div>
                <span className="text-sm text-muted">Demo only</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <SimulatorButton label="Focused" signal="focused" onClick={simulate} />
                <SimulatorButton label="Task Switch" signal="task_switch" onClick={simulate} />
                <SimulatorButton label="Long Idle Time" signal="long_idle" onClick={simulate} />
                <SimulatorButton label="Group Drift" signal="group_drift" onClick={simulate} />
                <SimulatorButton label="Back on Track" signal="back_on_track" onClick={simulate} />
                <SimulatorButton label="Need a Break" signal="need_break" onClick={simulate} />
              </div>
            </section>
          )}
        </section>

      </div>

      <PrivacyDetailsModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <DemoScriptPanel open={scriptOpen} onClose={() => setScriptOpen(false)} />
      {showReport && (
        <EndSessionReport
          report={buildReport()}
          focusHistory={focusHistory}
          onStartAnother={startAnotherSession}
          onReturnHome={() => router.push("/")}
        />
      )}
    </main>
  );
}

function StatusPill({ status }: { status: MemberStatus }) {
  const styles: Record<MemberStatus, string> = {
    focused: "text-primary",
    taking_break: "text-primary",
    needs_reset: "text-primary",
    not_sharing_activity: "text-muted"
  };

  const labels: Record<MemberStatus, string> = {
    focused: "Focused",
    taking_break: "Taking a break",
    needs_reset: "Needs a reset",
    not_sharing_activity: "Not sharing activity"
  };

  return (
    <span className={`inline-flex shrink-0 items-center gap-2 text-xs font-medium ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "taking_break" ? "bg-break" : status === "not_sharing_activity" ? "bg-muted" : "bg-focus"}`} aria-hidden="true" />
      {labels[status]}
    </span>
  );
}

function SimulatorButton({
  label,
  signal,
  onClick
}: {
  label: string;
  signal: ActivitySignal;
  onClick: (signal: ActivitySignal) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(signal)}
      className="rounded-lg border border-border bg-background px-4 py-3 text-left font-semibold text-primary transition duration-200 hover:bg-surfaceHover focus-visible:bg-surfaceHover"
    >
      {label}
    </button>
  );
}

function RoomConnectionIndicator({
  mode,
  connectionState
}: {
  mode: RoomConfig["mode"];
  connectionState: string;
}) {
  if (mode === "demo") {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary">
        Sample room
      </span>
    );
  }

  if (mode === "local") {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted">
        <WifiOff aria-hidden="true" size={16} />
        Local Preview Mode
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary">
      <Wifi aria-hidden="true" size={16} className="text-muted" />
      {connectionState === "live" ? "Live room" : connectionState === "reconnecting" ? "Reconnecting..." : "Connecting live room"}
    </span>
  );
}

function SharedPomodoroPanel({
  phase,
  label,
  remainingLabel,
  progress,
  cycleNumber,
  isRunning
}: {
  phase: RoomPhase;
  label: string;
  remainingLabel: string;
  progress: number;
  cycleNumber: number;
  isRunning: boolean;
}) {
  return (
    <section className="border-b border-border pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted">Shared Pomodoro</p>
          <h2 className="mt-2 text-2xl font-semibold">{label}</h2>
          <p className="mt-2 text-sm text-muted">
            Cycle {cycleNumber}. Focus runs for the selected time, followed by one five-minute break.
          </p>
        </div>
        <div className="text-left lg:text-right">
          <p className="font-mono text-3xl font-semibold text-primary">{remainingLabel}</p>
          <p className="mt-1 text-xs text-muted">
            {phase === "lobby" ? "Starting automatically" : isRunning ? phase === "break" ? "Break unlocked" : "Working together" : "Syncing timer"}
          </p>
        </div>
      </div>

      <div className="mt-5 h-2 rounded-small bg-surfaceMuted">
        <div className="h-full rounded-small bg-focus transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>

      <p className="mt-5 text-sm font-medium text-primary">
        {phase === "break"
          ? `${remainingLabel} left in your five-minute break.`
          : `${remainingLabel} until your five-minute break.`}
      </p>
    </section>
  );
}

function DemoScriptPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4" role="dialog" aria-modal="true" aria-labelledby="demo-script-title">
      <div className="dialog-surface w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Judge Demo</p>
            <h2 id="demo-script-title" className="mt-2 text-2xl font-semibold">Three-minute story</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-control border border-border p-2" aria-label="Close demo script" title="Close demo script">
            <X aria-hidden="true" size={19} />
          </button>
        </div>
        <ol className="mt-6 space-y-3 text-muted">
          <li>Enter seeded room CREW42 and show the strong group focus score.</li>
          <li>Click Simulate Group Drift and watch the score, statuses, coach, and chart update.</li>
          <li>Start a three-minute reset from the anonymous recovery card.</li>
          <li>Click Back on Track to show recovery without naming any student.</li>
          <li>End the session and show the polished insight report.</li>
        </ol>
      </div>
    </div>
  );
}

function calculateGroupFocusScore(statuses: ParticipantStatus[]) {
  const values: number[] = [];

  for (const status of statuses) {
    if (status === "focused") {
      values.push(100);
    }

    if (status === "taking_break") {
      values.push(70);
    }

    if (status === "needs_reset") {
      values.push(55);
    }
  }

  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getFocusLabel(score: number) {
  if (score >= 85) {
    return "Group is locked in";
  }

  if (score >= 65) {
    return "Steady focus";
  }

  if (score >= 40) {
    return "Focus is slipping";
  }

  return "Time for a reset";
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
