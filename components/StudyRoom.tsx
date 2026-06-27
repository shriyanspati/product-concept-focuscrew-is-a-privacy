"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Clock3,
  Copy,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConsentScreen } from "@/components/ConsentScreen";
import { BreakLounge } from "@/components/BreakLounge";
import { EndSessionReport } from "@/components/EndSessionReport";
import { FocusCheckModal } from "@/components/FocusCheckModal";
import { PrivacyDetailsModal } from "@/components/PrivacyDetailsModal";
import { ScreenCheckPanel } from "@/components/ScreenCheckPanel";
import { SoryvoLogo } from "@/components/SoryvoLogo";
import { useLiveRoom } from "@/hooks/useLiveRoom";
import { useSyncedPomodoro } from "@/hooks/useSyncedPomodoro";
import { initialFocusHistory, seededMembers } from "@/lib/demoData";
import { getFallbackFocusCoach, requestFocusCoach } from "@/lib/focusCoach";
import {
  endBreak,
  endRoom,
  insertLiveRoomEvent,
  liveRoomsAvailable,
  pausePomodoro,
  resumePomodoro,
  startBreak,
  startPomodoro,
  updateAccountabilityPulseOptIn,
  updateLiveParticipantStatus,
} from "@/lib/liveRoomApi";
import { localRoomAdapter } from "@/lib/storageAdapter";
import { getSupabaseBrowserClient, isEmailSession } from "@/lib/supabaseClient";
import type {
  ActivitySignal,
  FocusCheckFrequency,
  FocusCheckStoredState,
  FocusCoachOutput,
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
  const [selectedSignal, setSelectedSignal] = useState<ActivitySignal>("focused");
  const [focusedMinutes, setFocusedMinutes] = useState(14);
  const [recoveryMoments, setRecoveryMoments] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [sharingPaused, setSharingPaused] = useState(false);
  const [coach, setCoach] = useState<FocusCoachOutput>(() =>
    getFallbackFocusCoach({
      userGoal: "Review photosynthesis notes and finish a five-question check",
      subject: "AP Biology",
      sessionDuration: 25,
      focusedMinutes: 14,
      recentActivitySignals: ["focused"],
      groupFocusScore: 84,
      groupDriftCount: 0,
      userSelectedState: "focused",
      energyLevel: "steady"
    })
  );
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachSuccess, setCoachSuccess] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [actionSteps, setActionSteps] = useState<string[] | null>(null);
  const [resetActive, setResetActive] = useState(false);
  const [inviteJoinRequired, setInviteJoinRequired] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joinGoal, setJoinGoal] = useState("");
  const [joinSubject, setJoinSubject] = useState("Study Session");
  const [joiningLiveRoom, setJoiningLiveRoom] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [focusCheckOpen, setFocusCheckOpen] = useState(false);
  const [focusCheckFrequency, setFocusCheckFrequency] = useState<FocusCheckFrequency>("12");
  const [nextFocusCheckAt, setNextFocusCheckAt] = useState<number | null>(null);
  const [focusCheckNow, setFocusCheckNow] = useState<number | null>(null);
  const [focusCheckMessage, setFocusCheckMessage] = useState("No private check yet.");
  const [demoActivityCategory, setDemoActivityCategory] = useState<"unknown" | "social_media" | "idle">("unknown");
  const [lastPrivateFocusCheckState, setLastPrivateFocusCheckState] = useState<FocusCheckStoredState | null>(null);
  const [accountabilityPulseVisible, setAccountabilityPulseVisible] = useState(false);
  const [pulseCooldownActive, setPulseCooldownActive] = useState(false);

  const liveEnabled = ready && config.consentAccepted && config.mode === "live" && !config.judgeDemo;
  const liveRoom = useLiveRoom({ roomCode, config, enabled: liveEnabled });
  const isLiveCreator = Boolean(
    liveRoom.snapshot?.room.createdByUserId &&
    liveRoom.snapshot.currentParticipant.userId === liveRoom.snapshot.room.createdByUserId
  );
  const handlePomodoroExpired = useCallback(async (phase: RoomPhase) => {
    if (!liveRoom.snapshot || !isLiveCreator) {
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
    onPhaseExpired: handlePomodoroExpired
  });

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
    setGoalDraft(nextConfig.goal);
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

      if (!cancelled && isEmailSession(data.session) && typeof metadataName === "string") {
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

  const recoveryCardVisible = groupDriftCount >= 2 || groupFocusScore < 55 || accountabilityPulseVisible;

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
      mode: "live"
    }));
    setGoalDraft(snapshot.currentParticipant.goal);

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

  const sharedBreakActive = config.mode === "live"
    ? liveRoom.snapshot?.room.phase === "break"
    : selectedSignal === "need_break";
  const roomIsFocusPhase = config.mode === "live"
    ? liveRoom.snapshot?.room.phase === "focus"
    : !sharedBreakActive && !showReport;
  const activeParticipantCount = members.filter((member) => member.sharing).length;
  const optedInCount = members.filter((member) => member.accountabilityPulseOptIn).length;
  const currentMemberId = liveRoom.snapshot?.currentParticipant.id ?? "current";
  const currentAccountabilityOptedIn = members.find((member) => member.id === currentMemberId)?.accountabilityPulseOptIn ?? false;

  useEffect(() => {
    const pulseEvent = liveRoom.snapshot?.events.find((event) => event.eventType === "accountability_pulse_started");
    if (!pulseEvent) {
      return;
    }

    const remaining = 10 * 60 * 1000 - (Date.now() - new Date(pulseEvent.createdAt).getTime());
    setAccountabilityPulseVisible(true);
    if (remaining <= 0) {
      setPulseCooldownActive(false);
      return;
    }

    setPulseCooldownActive(true);
    const timeout = window.setTimeout(() => setPulseCooldownActive(false), remaining);
    return () => window.clearTimeout(timeout);
  }, [liveRoom.snapshot?.events]);

  const updateCoach = useCallback(async (signal: ActivitySignal, score = groupFocusScore) => {
    setCoachLoading(true);
    setCoachSuccess(false);
    const signals = [...recentSignals.slice(-4), signal];
    setRecentSignals(signals);

    const nextCoach = await requestFocusCoach({
      userGoal: config.goal,
      subject: config.subject,
      sessionDuration: config.duration,
      focusedMinutes,
      recentActivitySignals: signals,
      groupFocusScore: score,
      groupDriftCount,
      userSelectedState: signal,
      energyLevel: "steady"
    });

    setCoach(nextCoach);
    setCoachLoading(false);
    setCoachSuccess(true);
    window.setTimeout(() => setCoachSuccess(false), 1400);
  }, [config.duration, config.goal, config.subject, focusedMinutes, groupDriftCount, groupFocusScore, recentSignals]);

  useEffect(() => {
    if (!ready || !config.consentAccepted || showReport) {
      return;
    }

    if (config.mode === "live") {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(interval);
          setShowReport(true);
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [config.consentAccepted, config.mode, ready, showReport]);

  useEffect(() => {
    if (liveRoom.snapshot?.room.phase === "ended") {
      setShowReport(true);
    }
  }, [liveRoom.snapshot?.room.phase]);

  useEffect(() => {
    const saved = window.localStorage.getItem("soryvo:focus-check-frequency") as FocusCheckFrequency | null;
    if (saved && ["10", "12", "20", "manual"].includes(saved)) {
      setFocusCheckFrequency(saved);
    }
  }, []);

  useEffect(() => {
    setFocusCheckNow(Date.now());
    const interval = window.setInterval(() => setFocusCheckNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("soryvo:focus-check-frequency", focusCheckFrequency);

    if (focusCheckFrequency === "manual") {
      setNextFocusCheckAt(null);
      return;
    }

    setNextFocusCheckAt(Date.now() + Number(focusCheckFrequency) * 60 * 1000);
  }, [focusCheckFrequency]);

  useEffect(() => {
    if (!config.consentAccepted || focusCheckFrequency === "manual" || !nextFocusCheckAt || focusCheckOpen || showReport) {
      return;
    }

    if (liveRoom.snapshot?.room.phase === "break") {
      return;
    }

    const interval = window.setInterval(() => {
      if (Date.now() >= nextFocusCheckAt && config.goal.trim()) {
        setFocusCheckOpen(true);
        setNextFocusCheckAt(Date.now() + Number(focusCheckFrequency) * 60 * 1000);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [config.consentAccepted, config.goal, focusCheckFrequency, focusCheckOpen, liveRoom.snapshot?.room.phase, nextFocusCheckAt, showReport]);

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
    setResetActive(false);
    setActionSteps(null);

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
      setAccountabilityPulseVisible(false);
    }

    if (signal === "need_break") {
      applyScore(58);
      setMembers((current) =>
        current.map((member, index) => index === 0 || index === 1 ? { ...member, status: "taking_break" } : member)
      );
    }

    const nextScore = scoreForSignal(signal);
    void updateCoach(signal, nextScore);
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
    setAccountabilityPulseVisible(false);
    setSelectedSignal("reset_started");
    applyScore(57);
    if (config.mode !== "live") {
      setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "needs_reset" : "not_sharing_activity" })));
    }
    if (liveRoom.snapshot) {
      void insertLiveRoomEvent({ roomId: liveRoom.snapshot.room.id, eventType: "shared_reset_started" });
    }
    void updateCoach("reset_started", 57);
  }

  function keepGoing() {
    setSelectedSignal("focused");
    applyScore(Math.max(groupFocusScore, 63));
    void updateCoach("focused", Math.max(groupFocusScore, 63));
  }

  function takeSharedBreak() {
    setSelectedSignal("need_break");
    setMembers((current) => current.map((member) => ({ ...member, status: member.sharing ? "taking_break" : "not_sharing_activity" })));
    applyScore(60);
    setAccountabilityPulseVisible(false);
    if (liveRoom.snapshot) {
      void startBreak(liveRoom.snapshot.room.id).catch((error) => {
        setJoinError(error instanceof Error ? error.message : "Only the room creator can start a shared break.");
      });
      void updateCurrentPublicStatus("taking_break");
    }
    void updateCoach("need_break", 60);
  }

  function takeIntentionalBreak() {
    if (config.mode === "live") {
      void updateCurrentPublicStatus("taking_break");
      void updateCoach("need_break", 60);
      return;
    }

    simulate("need_break");
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

  async function changeAccountabilityPulseOptIn(optedIn: boolean) {
    setMembers((current) => current.map((member) =>
      member.id === currentMemberId ? { ...member, accountabilityPulseOptIn: optedIn } : member
    ));

    if (!liveRoom.snapshot?.currentParticipant.id) {
      return;
    }

    try {
      await updateAccountabilityPulseOptIn({
        participantId: liveRoom.snapshot.currentParticipant.id,
        optedIn
      });
    } catch {
      setMembers((current) => current.map((member) =>
        member.id === currentMemberId ? { ...member, accountabilityPulseOptIn: !optedIn } : member
      ));
      setJoinError("Accountability Pulse preference could not sync.");
    }
  }

  async function requestAccountabilityPulse() {
    if (members.length < 3 || activeParticipantCount < 3) {
      return "Accountability Pulse needs at least three active room members.";
    }
    if (optedInCount !== members.length) {
      return "The pulse stays private until every current room member opts in.";
    }
    if (!roomIsFocusPhase) {
      return "Accountability Pulse is available only during a focus phase.";
    }
    if (pulseCooldownActive) {
      return "The room already received a pulse in the last ten minutes.";
    }

    if (liveRoom.snapshot) {
      try {
        await insertLiveRoomEvent({
          roomId: liveRoom.snapshot.room.id,
          eventType: "accountability_pulse_started"
        });
      } catch {
        return "The anonymous pulse could not sync. Your private reset request was not shared.";
      }
    }

    setAccountabilityPulseVisible(true);
    setPulseCooldownActive(true);
    setRecoveryMoments((count) => count + 1);
    window.setTimeout(() => setPulseCooldownActive(false), 10 * 60 * 1000);
    return "Anonymous lock-in invitation sent. No identity or screen details were shared.";
  }

  function updateGoal() {
    const nextGoal = goalDraft.trim() || config.goal;
    const nextConfig = { ...config, goal: nextGoal };
    setConfig(nextConfig);
    localRoomAdapter.saveRoomConfig(nextConfig);
    setMembers((current) =>
      current.map((member) => member.id === "current" ? { ...member, goal: nextGoal } : member)
    );
    setGoalEditing(false);
    void updateCoach("focused");
  }

  function markStuck() {
    setSelectedSignal("stuck");
    setMembers((current) =>
      current.map((member) => member.id === "current" ? { ...member, status: "needs_reset" } : member)
    );
    applyScore(Math.min(groupFocusScore, 54));
    void updateCurrentPublicStatus("needs_reset");
    void updateCoach("stuck", Math.min(groupFocusScore, 54));
  }

  async function updateCurrentPublicStatus(status: ParticipantStatus, focusCheckState?: FocusCheckStoredState) {
    setMembers((current) =>
      current.map((member) => member.id === "current" || member.id === config.liveParticipantId ? { ...member, status } : member)
    );

    if (liveRoom.snapshot?.currentParticipant.id) {
      try {
        await updateLiveParticipantStatus({
          participantId: liveRoom.snapshot.currentParticipant.id,
          status,
          focusCheckState
        });
      } catch {
        setJoinError("Live status update could not sync. Your local room view is still usable.");
      }
    }
  }

  function breakTaskIntoSteps() {
    setActionSteps([
      `Open the exact material for ${config.subject}.`,
      `Spend five minutes on: ${coach.microTask}.`,
      "Mark one question for the group if you still feel stuck."
    ]);
    void updateCoach(selectedSignal);
  }

  function explainNextStep() {
    setCoach((current) => ({
      ...current,
      privateMessage: `Next step: ${current.microTask}. Keep it visible, finish only that piece, then check back in.`
    }));
  }

  function openFocusCheck() {
    if (!config.goal.trim()) {
      setFocusCheckMessage("Add one clear study goal before starting a Focus Check.");
      return;
    }

    if (liveRoom.snapshot?.room.phase === "break") {
      setFocusCheckMessage("Focus Check pauses during a shared break.");
      return;
    }

    setFocusCheckOpen(true);
  }

  function completeFocusCheck(result: {
    publicStatus: ParticipantStatus;
    storedState: FocusCheckStoredState;
    focusCheckResult: { message: string; suggestedAction: string };
  }) {
    setFocusCheckMessage(`${result.focusCheckResult.message} ${result.focusCheckResult.suggestedAction}`);
    setLastPrivateFocusCheckState(result.storedState);
    void updateCurrentPublicStatus(result.publicStatus, result.storedState);

    if (focusCheckFrequency !== "manual") {
      setNextFocusCheckAt(Date.now() + Number(focusCheckFrequency) * 60 * 1000);
    }
  }

  function triggerDemoFocusCheck(kind: "clear" | "vague" | "stuck" | "break" | "mismatch") {
    if (kind === "mismatch") {
      setDemoActivityCategory("social_media");
    } else if (kind === "break") {
      setDemoActivityCategory("idle");
    } else {
      setDemoActivityCategory("unknown");
    }

    setFocusCheckOpen(true);
  }

  async function copyInviteLink() {
    if (config.mode !== "live") {
      setJoinError("Invite links are available for live Supabase rooms. This room is in Local Preview Mode.");
      return;
    }

    await window.navigator.clipboard.writeText(`${window.location.origin}/room/${config.roomCode}`);
    setJoinError("Invite link copied.");
  }

  async function runLiveTimerAction(action: "start" | "pause" | "resume" | "break" | "focus" | "end") {
    if (!liveRoom.snapshot) {
      setJoinError("Live room is still connecting.");
      return;
    }

    if (!isLiveCreator) {
      setJoinError("Only the room creator can control the shared timer.");
      return;
    }

    try {
      if (action === "start") {
        await startPomodoro(liveRoom.snapshot.room.id);
      }

      if (action === "pause") {
        await pausePomodoro(liveRoom.snapshot.room.id);
      }

      if (action === "resume") {
        await resumePomodoro(liveRoom.snapshot.room.id);
      }

      if (action === "break") {
        await startBreak(liveRoom.snapshot.room.id);
      }

      if (action === "focus") {
        await endBreak(liveRoom.snapshot.room.id);
      }

      if (action === "end") {
        await endRoom(liveRoom.snapshot.room.id);
        setShowReport(true);
      }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Shared timer action failed.");
    }
  }

  function endCurrentSession() {
    if (config.mode === "live" && liveRoom.snapshot && isLiveCreator) {
      void runLiveTimerAction("end");
      return;
    }

    setShowReport(true);
  }

  async function submitInviteJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (liveRoomsAvailable()) {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };

      if (!isEmailSession(data.session)) {
        const params = new URLSearchParams();
        const nextName = joinName.trim();

        if (nextName) {
          params.set("name", nextName);
        }

        params.set("next", `/room/${roomCode}`);
        setJoinError("Sign in with email before joining a live room.");
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
      consentAccepted: false
    };
    setConfig(nextConfig);
    setGoalDraft(nextConfig.goal);
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
    void updateCoach("focused", 84);
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
            onClick={endCurrentSession}
            className="rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-break"
          >
            End Session
          </button>
          <button
            type="button"
            onClick={() => router.push("/room")}
            className="rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
          >
            Leave Room
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
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_23rem]">
        <section className="space-y-5">
          {config.mode === "live" && liveRoom.snapshot && (
            <SharedPomodoroPanel
              phase={syncedPomodoro.phase}
              label={syncedPomodoro.label}
              remainingLabel={syncedPomodoro.remainingLabel}
              progress={syncedPomodoro.progress}
              cycleNumber={syncedPomodoro.cycleNumber}
              isRunning={syncedPomodoro.isRunning}
              isCreator={isLiveCreator}
              onStart={() => void runLiveTimerAction("start")}
              onPause={() => void runLiveTimerAction("pause")}
              onResume={() => void runLiveTimerAction("resume")}
              onBreak={() => void runLiveTimerAction("break")}
              onFocus={() => void runLiveTimerAction("focus")}
              onSuggestBreak={() => {
                setJoinError("Break suggestion noted anonymously. The room creator can start the shared break.");
              }}
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
                    <h2 className="mt-2 text-2xl font-semibold">
                      {accountabilityPulseVisible ? "Momentum dip in the room." : "Focus dip detected."}
                    </h2>
                    <p className="mt-2 text-muted">
                      {accountabilityPulseVisible
                        ? "Want a 90-second lock-in together? No identity or private screen details were shared."
                        : "Want to start a three-minute group lock-in? Soryvo never names who caused the dip."}
                    </p>
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
                    <button type="button" onClick={takeSharedBreak} className="rounded-lg bg-break px-4 py-3 font-semibold text-primary transition hover:bg-breakDark">
                      Take a Shared Break
                    </button>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <BreakLounge
            open={config.judgeDemo ? selectedSignal === "need_break" : liveRoom.snapshot?.room.phase === "break"}
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
              <div className="mt-5 border-t border-border pt-5">
                <p className="mb-3 text-sm font-semibold text-primary">Focus Check demo controls</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <button type="button" onClick={openFocusCheck} className="rounded-control border border-border px-4 py-3 text-left font-semibold text-primary transition hover:bg-surfaceHover">
                    Trigger Focus Check
                  </button>
                  <button type="button" onClick={() => triggerDemoFocusCheck("clear")} className="rounded-control border border-border px-4 py-3 text-left font-semibold text-primary transition hover:bg-surfaceHover">
                    Simulate Clear Alignment
                  </button>
                  <button type="button" onClick={() => triggerDemoFocusCheck("vague")} className="rounded-control border border-border px-4 py-3 text-left font-semibold text-primary transition hover:bg-surfaceHover">
                    Simulate Vague Answer
                  </button>
                  <button type="button" onClick={() => triggerDemoFocusCheck("stuck")} className="rounded-control border border-border px-4 py-3 text-left font-semibold text-primary transition hover:bg-surfaceHover">
                    Simulate Stuck
                  </button>
                  <button type="button" onClick={() => triggerDemoFocusCheck("break")} className="rounded-control border border-border px-4 py-3 text-left font-semibold text-primary transition hover:bg-surfaceHover">
                    Simulate Intentional Break
                  </button>
                  <button type="button" onClick={() => triggerDemoFocusCheck("mismatch")} className="rounded-control border border-border px-4 py-3 text-left font-semibold text-primary transition hover:bg-surfaceHover">
                    Simulate Activity Mismatch
                  </button>
                </div>
              </div>
            </section>
          )}
        </section>

        <aside className="space-y-5">
          <section className="border-b border-border pb-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Personal task</p>
                <h2 className="mt-2 text-xl font-semibold">Your focus lane</h2>
              </div>
            </div>

            {goalEditing ? (
              <div className="space-y-3">
                <textarea
                  value={goalDraft}
                  onChange={(event) => setGoalDraft(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-sm"
                />
                <button type="button" onClick={updateGoal} className="w-full rounded-lg bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark">
                  Save Goal
                </button>
              </div>
            ) : (
              <p className="border-l-2 border-border pl-4 text-sm leading-6 text-primary">
                {config.goal}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MetricSmall label="Progress" value={`${Math.max(0, progress)}%`} />
              <MetricSmall label="Focus streak" value={`${focusedMinutes}m`} />
            </div>

            <ScreenCheckPanel
              goal={config.goal}
              subject={config.subject}
              activityCategory={demoActivityCategory}
              privateFocusCheckState={lastPrivateFocusCheckState}
              focusCheckOpen={focusCheckOpen}
              isFocusPhase={roomIsFocusPhase}
              pauseRequested={sharedBreakActive || showReport}
              pauseReason={sharedBreakActive
                ? "Screen Check paused during the shared break."
                : "Screen Check paused because the session ended."}
              judgeDemo={config.judgeDemo}
              accountabilityOptedIn={currentAccountabilityOptedIn}
              participantCount={members.length}
              activeParticipantCount={activeParticipantCount}
              optedInCount={optedInCount}
              pulseCooldownActive={pulseCooldownActive}
              onAccountabilityOptInChange={changeAccountabilityPulseOptIn}
              onAccountabilityPulse={requestAccountabilityPulse}
            />

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Focus Check</p>
                  <p className="mt-1 text-xs text-muted">{formatFocusCheckSchedule(nextFocusCheckAt, focusCheckFrequency, focusCheckNow)}</p>
                </div>
                <select
                  value={focusCheckFrequency}
                  onChange={(event) => setFocusCheckFrequency(event.target.value as FocusCheckFrequency)}
                  className="rounded-lg border border-border bg-surface px-2 py-2 text-xs text-primary"
                  aria-label="Focus Check frequency"
                >
                  <option value="10">Every 10 minutes</option>
                  <option value="12">Every 12 minutes</option>
                  <option value="20">Every 20 minutes</option>
                  <option value="manual">Only when I request it</option>
                </select>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{focusCheckMessage}</p>
              <button
                type="button"
                onClick={openFocusCheck}
                className="mt-3 w-full rounded-lg bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark"
              >
                Check my focus
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <button type="button" onClick={() => setGoalEditing(true)} className="w-full rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
                Update Goal
              </button>
              <button type="button" onClick={markStuck} className="w-full rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
                I&apos;m Stuck
              </button>
              <button type="button" onClick={takeIntentionalBreak} className="w-full rounded-lg bg-break px-4 py-3 font-semibold text-primary transition hover:bg-breakDark">
                Take Intentional Break
              </button>
            </div>
          </section>

          <section className="border-b border-border pb-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">Focus coach</p>
                <h2 className="mt-2 text-xl font-semibold">Supportive next move</h2>
              </div>
              {coachLoading && <Loader2 aria-hidden="true" className="animate-spin text-muted" />}
            </div>

            <div className="border-l-2 border-focus pl-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {coach.status.replace("_", " ")}
                </span>
                {coachSuccess && <span className="inline-flex items-center gap-1 text-xs text-muted"><Check size={14} /> Updated</span>}
              </div>
              <p className="leading-7 text-primary">{coach.privateMessage}</p>
              {coach.groupMessage && (
                <p className="mt-3 border-l-2 border-focus pl-3 text-sm leading-6 text-primary">
                  {coach.groupMessage}
                </p>
              )}
            </div>

            {actionSteps && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="font-semibold">Tiny task plan</p>
                <ol className="mt-3 space-y-2 text-sm text-muted">
                  {actionSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-5 space-y-2">
              <button type="button" onClick={() => updateCoach(selectedSignal)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark">
                Get a Reset Prompt
              </button>
              <button type="button" onClick={breakTaskIntoSteps} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
                Break Task Into Steps
              </button>
              <button type="button" onClick={explainNextStep} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
                Explain My Next Step
              </button>
            </div>
          </section>
        </aside>
      </div>

      <PrivacyDetailsModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <DemoScriptPanel open={scriptOpen} onClose={() => setScriptOpen(false)} />
      <FocusCheckModal
        open={focusCheckOpen}
        goal={config.goal}
        subject={config.subject}
        demoCategory={demoActivityCategory}
        onClose={() => setFocusCheckOpen(false)}
        onComplete={completeFocusCheck}
      />
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

function MetricSmall({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
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
  isRunning,
  isCreator,
  onStart,
  onPause,
  onResume,
  onBreak,
  onFocus,
  onSuggestBreak
}: {
  phase: RoomPhase;
  label: string;
  remainingLabel: string;
  progress: number;
  cycleNumber: number;
  isRunning: boolean;
  isCreator: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onBreak: () => void;
  onFocus: () => void;
  onSuggestBreak: () => void;
}) {
  return (
    <section className="border-b border-border pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-muted">Shared Pomodoro</p>
          <h2 className="mt-2 text-2xl font-semibold">{label}</h2>
          <p className="mt-2 text-sm text-muted">
            Cycle {cycleNumber}. Timer control is synced for the room and limited to the creator.
          </p>
        </div>
        <div className="text-left lg:text-right">
          <p className="font-mono text-3xl font-semibold text-primary">{remainingLabel}</p>
          <p className="mt-1 text-xs text-muted">{isRunning ? "Running" : "Paused or waiting"}</p>
        </div>
      </div>

      <div className="mt-5 h-2 rounded-small bg-surfaceMuted">
        <div className="h-full rounded-small bg-focus transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {phase === "lobby" && (
          <button type="button" onClick={onStart} disabled={!isCreator} className="rounded-control bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-45">
            Start Focus Session
          </button>
        )}
        {phase === "focus" && (
          <>
            <button type="button" onClick={isRunning ? onPause : onResume} disabled={!isCreator} className="rounded-control border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover disabled:cursor-not-allowed disabled:opacity-45">
              {isRunning ? "Pause Timer" : "Resume Timer"}
            </button>
            <button type="button" onClick={onBreak} disabled={!isCreator} className="rounded-control bg-break px-4 py-3 font-semibold text-primary transition hover:bg-breakDark disabled:cursor-not-allowed disabled:opacity-45">
              Start Break
            </button>
          </>
        )}
        {phase === "break" && (
          <button type="button" onClick={onFocus} disabled={!isCreator} className="rounded-control bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-45">
            Back to Focus
          </button>
        )}
        {!isCreator && phase === "focus" && (
          <button type="button" onClick={onSuggestBreak} className="rounded-control border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover">
            Suggest a Break
          </button>
        )}
        {!isCreator && phase !== "focus" && (
          <span className="inline-flex items-center rounded-control border border-border px-4 py-3 text-sm text-muted">
            Waiting for the room creator
          </span>
        )}
      </div>
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

function scoreForSignal(signal: ActivitySignal) {
  const scores: Record<ActivitySignal, number> = {
    focused: 88,
    task_switch: 62,
    long_idle: 52,
    group_drift: 38,
    back_on_track: 86,
    need_break: 58,
    stuck: 54,
    reset_started: 57
  };

  return scores[signal];
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

function formatFocusCheckSchedule(nextFocusCheckAt: number | null, frequency: FocusCheckFrequency, now: number | null) {
  if (frequency === "manual") {
    return "Only when I request it";
  }

  if (!nextFocusCheckAt || !now) {
    return `Every ${frequency} minutes`;
  }

  const remaining = Math.max(0, Math.ceil((nextFocusCheckAt - now) / 1000));
  return `Next check in ${formatSeconds(remaining)}`;
}
