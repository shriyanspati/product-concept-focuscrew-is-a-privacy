"use client";

import { ensureEmailSession, getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type {
  FocusCheckStoredState,
  Participant,
  ParticipantStatus,
  Room,
  RoomEvent,
  RoomEventType,
  RoomPhase
} from "@/lib/types";

type LiveRoomPayload = {
  room: RoomRow;
  member?: ParticipantRow;
  participant?: ParticipantRow;
  members?: ParticipantRow[];
  participants?: ParticipantRow[];
  events?: RoomEventRow[];
};

type RoomRow = {
  id: string;
  room_code: string;
  created_at: string;
  ended_at?: string | null;
  created_by: string;
  title: string;
  subject: string | null;
  focus_minutes: number;
  break_minutes: number;
  phase: RoomPhase;
  phase_started_at: string | null;
  phase_ends_at: string | null;
  cycle_number: number;
  is_running: boolean;
};

type ParticipantRow = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  goal: string | null;
  status: ParticipantStatus;
  joined_at: string;
  last_seen_at: string;
  last_focus_check_at: string | null;
  last_focus_check_state: FocusCheckStoredState | null;
  accountability_pulse_opt_in?: boolean;
};

type RoomEventRow = {
  id: string;
  room_id: string;
  event_type: RoomEventType;
  payload: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
};

export type LiveRoomSnapshot = {
  room: Room;
  currentParticipant: Participant;
  participants: Participant[];
  events: RoomEvent[];
};

export async function createLiveRoom(input: {
  displayName: string;
  goal: string;
  duration: number;
  subject?: string;
  title?: string;
}) {
  await ensureEmailSession();
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("create_live_room", {
    display_name_input: input.displayName,
    goal_input: input.goal,
    title_input: input.title ?? "Study room",
    subject_input: input.subject ?? null,
    focus_minutes_input: input.duration
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizePayload(data as LiveRoomPayload);
}

export async function joinLiveRoom(input: {
  roomCode: string;
  displayName: string;
  goal: string;
}) {
  await ensureEmailSession();
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc("join_live_room", {
    room_code_input: input.roomCode.toUpperCase(),
    display_name_input: input.displayName,
    goal_input: input.goal
  });

  if (error) {
    throw new Error(error.message);
  }

  return normalizePayload(data as LiveRoomPayload);
}

export async function fetchLiveRoomSnapshot(roomId: string, currentParticipantId: string) {
  const supabase = requireSupabase();
  const [roomResult, participantsResult, eventsResult] = await Promise.all([
    supabase.from("rooms").select("*").eq("id", roomId).single(),
    supabase.from("room_members").select("*").eq("room_id", roomId).order("joined_at", { ascending: true }),
    supabase.from("room_events").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20)
  ]);

  if (roomResult.error) {
    throw new Error(roomResult.error.message);
  }

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (eventsResult.error) {
    throw new Error(eventsResult.error.message);
  }

  const participants = (participantsResult.data ?? []) as ParticipantRow[];
  const currentParticipant = participants.find((participant) => participant.id === currentParticipantId) ?? participants[0];

  if (!currentParticipant) {
    throw new Error("Participant record was not found.");
  }

  return normalizePayload({
    room: roomResult.data as RoomRow,
    member: currentParticipant,
    members: participants,
    events: (eventsResult.data ?? []) as RoomEventRow[]
  });
}

export async function updateLiveParticipantStatus(input: {
  participantId: string;
  status: ParticipantStatus;
  focusCheckState?: FocusCheckStoredState;
}) {
  const supabase = requireSupabase();
  const now = new Date().toISOString();
  const patch: Partial<ParticipantRow> = {
    status: input.status,
    last_seen_at: now
  };

  if (input.focusCheckState) {
    patch.last_focus_check_at = now;
    patch.last_focus_check_state = input.focusCheckState;
  }

  const { error } = await supabase.from("room_members").update(patch).eq("id", input.participantId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAccountabilityPulseOptIn(input: {
  participantId: string;
  optedIn: boolean;
}) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("room_members")
    .update({ accountability_pulse_opt_in: input.optedIn, last_seen_at: new Date().toISOString() })
    .eq("id", input.participantId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function heartbeatRoomMember(input: {
  roomId: string;
  status?: ParticipantStatus;
}) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("heartbeat_room_member", {
    room_id_input: input.roomId,
    status_input: input.status ?? null
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function startPomodoro(roomId: string) {
  return callRoomRpc("start_pomodoro", roomId);
}

export async function pausePomodoro(roomId: string) {
  return callRoomRpc("pause_pomodoro", roomId);
}

export async function resumePomodoro(roomId: string) {
  return callRoomRpc("resume_pomodoro", roomId);
}

export async function startBreak(roomId: string) {
  return callRoomRpc("start_break", roomId);
}

export async function endBreak(roomId: string) {
  return callRoomRpc("end_break", roomId);
}

export async function endRoom(roomId: string) {
  return callRoomRpc("end_room", roomId);
}

export async function leaveLiveRoom(roomId: string) {
  return callRoomRpc("leave_room", roomId);
}

export async function insertLiveRoomEvent(input: {
  roomId: string;
  eventType: RoomEventType;
  payload?: Record<string, unknown>;
}) {
  const supabase = requireSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("A signed-in room member is required.");
  }

  const { error } = await supabase.from("room_events").insert({
    room_id: input.roomId,
    event_type: input.eventType,
    payload: input.payload ?? {},
    created_by: userId
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function normalizePayload(payload: LiveRoomPayload): LiveRoomSnapshot {
  const currentMember = payload.member ?? payload.participant;
  const members = payload.members ?? payload.participants ?? [];

  if (!currentMember) {
    throw new Error("Live room payload did not include the current member.");
  }

  return {
    room: mapRoom(payload.room),
    currentParticipant: mapParticipant(currentMember),
    participants: members.map(mapParticipant),
    events: (payload.events ?? []).map(mapRoomEvent)
  };
}

export function liveRoomsAvailable() {
  return isSupabaseConfigured();
}

async function callRoomRpc(functionName: string, roomId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc(functionName, { room_id_input: roomId });

  if (error) {
    throw new Error(error.message);
  }
}

function requireSupabase() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Live rooms need Supabase setup.");
  }

  return supabase;
}

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    roomCode: row.room_code,
    createdAt: row.created_at,
    endedAt: row.ended_at ?? null,
    createdByUserId: row.created_by,
    title: row.title,
    subject: row.subject,
    focusMinutes: row.focus_minutes,
    breakMinutes: row.break_minutes,
    phase: row.phase,
    phaseStartedAt: row.phase_started_at,
    phaseEndsAt: row.phase_ends_at,
    cycleNumber: row.cycle_number,
    isRunning: row.is_running,
    sessionDurationMinutes: row.focus_minutes,
    sessionStartedAt: row.phase_started_at,
    sessionState: row.phase,
    sharedBreakEndsAt: row.phase === "break" ? row.phase_ends_at : null
  };
}

function mapParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    displayName: row.display_name,
    goal: row.goal ?? "Finish one focused study task",
    status: row.status,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    lastFocusCheckAt: row.last_focus_check_at,
    lastFocusCheckState: row.last_focus_check_state,
    accountabilityPulseOptIn: row.accountability_pulse_opt_in === true
  };
}

function mapRoomEvent(row: RoomEventRow): RoomEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    eventType: row.event_type,
    payload: row.payload ?? {},
    createdByUserId: row.created_by,
    createdAt: row.created_at
  };
}
