export type ParticipantStatus =
  | "focused"
  | "taking_break"
  | "needs_reset"
  | "not_sharing_activity";

export type MemberStatus = ParticipantStatus;

export type RoomPhase = "lobby" | "focus" | "break" | "ended";
export type RoomState = RoomPhase;

export type Room = {
  id: string;
  roomCode: string;
  createdAt: string;
  createdByUserId: string;
  title: string;
  subject: string | null;
  focusMinutes: number;
  breakMinutes: number;
  phase: RoomPhase;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  cycleNumber: number;
  isRunning: boolean;
  sessionDurationMinutes: number;
  sessionStartedAt: string | null;
  sessionState: RoomState;
  sharedBreakEndsAt: string | null;
};

export type Participant = {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  goal: string;
  status: ParticipantStatus;
  joinedAt: string;
  lastSeenAt: string;
  lastFocusCheckAt: string | null;
  lastFocusCheckState: FocusCheckStoredState | null;
  accountabilityPulseOptIn: boolean;
};

export type RoomEventType =
  | "room_started"
  | "focus_started"
  | "break_started"
  | "break_ended"
  | "room_paused"
  | "room_ended"
  | "shared_reset_started"
  | "shared_break_started"
  | "shared_break_ended"
  | "session_started"
  | "session_ended"
  | "accountability_pulse_started";

export type RoomEvent = {
  id: string;
  roomId: string;
  eventType: RoomEventType;
  payload: Record<string, unknown>;
  createdByUserId: string;
  createdAt: string;
};

export type ActivitySignal =
  | "focused"
  | "task_switch"
  | "long_idle"
  | "group_drift"
  | "back_on_track"
  | "need_break"
  | "stuck"
  | "reset_started";

export type ActivityCategory =
  | "study_tool"
  | "writing_tool"
  | "research_tool"
  | "neutral_tool"
  | "social_media"
  | "idle"
  | "unknown";

export type FocusCoachStatus =
  | "focused"
  | "drifting"
  | "stuck"
  | "break_recommended"
  | "recovering";

export type FocusCoachTone = "encouraging" | "calm" | "celebratory";

export type FocusCoachInput = {
  userGoal: string;
  subject: string;
  sessionDuration: number;
  focusedMinutes: number;
  recentActivitySignals: ActivitySignal[];
  groupFocusScore: number;
  groupDriftCount: number;
  userSelectedState: ActivitySignal;
  energyLevel?: "low" | "steady" | "high";
};

export type FocusCoachOutput = {
  status: FocusCoachStatus;
  confidence: number;
  privateMessage: string;
  groupMessage: string | null;
  suggestedAction: string;
  microTask: string;
  tone: FocusCoachTone;
};

export type RoomMember = {
  id: string;
  name: string;
  goal: string;
  status: MemberStatus;
  sharing: boolean;
  accountabilityPulseOptIn: boolean;
};

export type FocusPoint = {
  minute: number;
  score: number;
};

export type RoomConfig = {
  displayName: string;
  subject: string;
  duration: number;
  goal: string;
  roomCode: string;
  judgeDemo: boolean;
  consentAccepted: boolean;
  mode?: "demo" | "live" | "local";
  liveRoomId?: string;
  liveParticipantId?: string;
};

export type SessionReport = {
  overallScore: number;
  focusedMinutes: number;
  recoveryMoments: number;
  strongestFocusPeriod: string;
  commonTrigger: string;
  personalNote: string;
  nextSuggestion: string;
};

export type FocusCheckStoredState = "clear" | "uncertain" | "needs_reset" | "break" | "skipped";

export type FocusCheckSelfReport = "on_task" | "stuck" | "taking_break" | "skipped";

export type FocusCheckFrequency = "10" | "12" | "20" | "manual";

export type ScreenCheckExpectedContext =
  | "writing_notes"
  | "research_pages"
  | "calculator_coding"
  | "video_lecture"
  | "class_group_chat";

export type ScreenCheckResultKind = "aligned" | "unclear" | "reset_suggested";

export type ScreenCheckPrivateResult = {
  kind: ScreenCheckResultKind;
  title: string;
  message: string;
};

export type FocusCheckResult = {
  alignment: "clear" | "uncertain" | "needs_reset";
  privateStatus: "focused" | "stuck" | "break";
  confidence: number;
  message: string;
  suggestedAction: string;
};

export type FocusCheckInput = {
  goal: string;
  subject?: string;
  selfReport: FocusCheckSelfReport;
  currentActivity?: string;
  nextTinyStep?: string;
  blocker?: string;
  activityCategory?: ActivityCategory;
};
