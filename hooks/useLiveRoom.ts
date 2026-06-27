"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const refresh = useCallback(async () => {
    if (!roomIdRef.current || !currentParticipantIdRef.current) {
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
    let cleanup: (() => void) | undefined;

    async function connect() {
      setConnectionState("connecting");
      setError(null);

      try {
        const joined = await joinLiveRoom({
          roomCode,
          displayName: config.displayName || "Guest",
          goal: config.goal || "Finish one focused study task"
        });

        if (cancelled) {
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
            if (status === "SUBSCRIBED") {
              setConnectionState("live");
            }

            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              setConnectionState("reconnecting");
            }
          });

        cleanup = () => {
          void supabaseClient.removeChannel(channel);
        };
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
      cleanup?.();
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
    const interval = window.setInterval(heartbeat, 30_000);

    const markLeaving = () => {
      if (roomIdRef.current) {
        void heartbeatRoomMember({
          roomId: roomIdRef.current,
          status: "not_sharing_activity"
        });
      }
    };

    window.addEventListener("beforeunload", markLeaving);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", markLeaving);
      markLeaving();
    };
  }, [enabled]);

  return {
    snapshot,
    connectionState,
    error,
    refresh
  };
}
