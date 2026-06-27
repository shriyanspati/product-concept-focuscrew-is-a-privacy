"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  fetchLiveRoomSnapshot,
  heartbeatRoomMember,
  joinLiveRoom,
  liveRoomsAvailable,
  type LiveRoomSnapshot
} from "@/lib/liveRoomApi";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { RoomConfig } from "@/lib/types";

type ConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "error" | "unavailable";

export function useLiveRoom({
  roomCode,
  config,
  enabled
}: {
  roomCode: string;
  config: RoomConfig;
  enabled: boolean;
}) {
  const [snapshot, setSnapshot] = useState<LiveRoomSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const currentParticipantIdRef = useRef<string | null>(config.liveParticipantId ?? null);
  const roomIdRef = useRef<string | null>(config.liveRoomId ?? null);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const beforeUnloadHandlerRef = useRef<(() => void) | null>(null);
  const intentionallyStoppedRef = useRef(false);
  const connectionGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (intentionallyStoppedRef.current || !roomIdRef.current || !currentParticipantIdRef.current) {
      return;
    }

    const nextSnapshot = await fetchLiveRoomSnapshot(roomIdRef.current, currentParticipantIdRef.current);
    setSnapshot(nextSnapshot);
  }, []);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      setConnectionState("idle");
      return;
    }

    if (intentionallyStoppedRef.current) {
      setConnectionState("idle");
      return;
    }

    if (!liveRoomsAvailable()) {
      setConnectionState("unavailable");
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setConnectionState("unavailable");
      return;
    }
    const supabaseClient = supabase;

    let cancelled = false;
    const generation = connectionGenerationRef.current + 1;
    connectionGenerationRef.current = generation;

    async function connect() {
      setConnectionState("connecting");
      setError(null);

      try {
        const joined = await joinLiveRoom({
          roomCode,
          displayName: config.displayName || "Guest",
          goal: config.goal || "Finish one focused study task"
        });

        if (cancelled || intentionallyStoppedRef.current || connectionGenerationRef.current !== generation) {
          return;
        }

        currentParticipantIdRef.current = joined.currentParticipant.id;
        roomIdRef.current = joined.room.id;
        setSnapshot(joined);

        const channel = supabaseClient
          .channel(`live-room:${joined.room.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${joined.room.id}` }, () => {
            void refreshRef.current?.();
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${joined.room.id}` }, () => {
            void refreshRef.current?.();
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "room_events", filter: `room_id=eq.${joined.room.id}` }, () => {
            void refreshRef.current?.();
          })
          .subscribe((status) => {
            if (intentionallyStoppedRef.current) {
              return;
            }
            if (status === "SUBSCRIBED") {
              setConnectionState("live");
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setConnectionState("reconnecting");
            }
          });
        channelRef.current = channel;
      } catch (connectError) {
        if (!cancelled) {
          setConnectionState("error");
          setError(connectError instanceof Error ? connectError.message : "Live room connection failed.");
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        const channel = channelRef.current;
        channelRef.current = null;
        void supabaseClient.removeChannel(channel);
      }
      setConnectionState("idle");
    };
  }, [config.displayName, config.goal, enabled, roomCode]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const heartbeat = () => {
      if (!roomIdRef.current) {
        return;
      }

      void heartbeatRoomMember({ roomId: roomIdRef.current }).catch(() => {
        setConnectionState((state) => state === "live" ? "reconnecting" : state);
      });
    };

    heartbeat();
    heartbeatIntervalRef.current = window.setInterval(heartbeat, 30_000);

    const markLeaving = () => {
      if (roomIdRef.current) {
        void heartbeatRoomMember({
          roomId: roomIdRef.current,
          status: "not_sharing_activity"
        });
      }
    };

    window.addEventListener("beforeunload", markLeaving);
    beforeUnloadHandlerRef.current = markLeaving;

    return () => {
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      window.removeEventListener("beforeunload", markLeaving);
      beforeUnloadHandlerRef.current = null;
      if (!intentionallyStoppedRef.current) {
        markLeaving();
      }
    };
  }, [enabled]);

  const unsubscribeRoom = useCallback(async () => {
    intentionallyStoppedRef.current = true;
    connectionGenerationRef.current += 1;

    if (heartbeatIntervalRef.current !== null) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (beforeUnloadHandlerRef.current) {
      window.removeEventListener("beforeunload", beforeUnloadHandlerRef.current);
      beforeUnloadHandlerRef.current = null;
    }

    const channel = channelRef.current;
    channelRef.current = null;
    const supabase = getSupabaseBrowserClient();
    if (channel && supabase) {
      await supabase.removeChannel(channel);
    }

    setConnectionState("idle");
  }, []);

  return {
    snapshot,
    connectionState,
    error,
    refresh,
    unsubscribeRoom
  };
}
