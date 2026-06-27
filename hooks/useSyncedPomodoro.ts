"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomPhase } from "@/lib/types";

type UseSyncedPomodoroInput = {
  room: Room | null | undefined;
  isCreator: boolean;
  onPhaseExpired?: (phase: RoomPhase) => Promise<void> | void;
};

export function useSyncedPomodoro({ room, isCreator, onPhaseExpired }: UseSyncedPomodoroInput) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const expireHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!room?.phaseEndsAt || room.phase === "lobby" || room.phase === "ended") {
      setRemainingSeconds(null);
      expireHandledRef.current = null;
      return;
    }

    const tick = () => {
      if (!room.isRunning) {
        return;
      }

      const remaining = Math.max(0, Math.ceil((new Date(room.phaseEndsAt ?? "").getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0 && isCreator && onPhaseExpired) {
        const expiryKey = `${room.id}:${room.phase}:${room.cycleNumber}`;
        if (expireHandledRef.current !== expiryKey) {
          expireHandledRef.current = expiryKey;
          void onPhaseExpired(room.phase);
        }
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [isCreator, onPhaseExpired, room?.cycleNumber, room?.id, room?.isRunning, room?.phase, room?.phaseEndsAt]);

  const totalSeconds = useMemo(() => {
    if (!room) {
      return null;
    }

    if (room.phase === "focus") {
      return room.focusMinutes * 60;
    }

    if (room.phase === "break") {
      return room.breakMinutes * 60;
    }

    return null;
  }, [room]);

  const elapsedSeconds = totalSeconds !== null && remainingSeconds !== null
    ? Math.max(0, totalSeconds - remainingSeconds)
    : 0;

  const progress = totalSeconds ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0;

  return {
    phase: room?.phase ?? "lobby",
    isRunning: room?.isRunning ?? false,
    cycleNumber: room?.cycleNumber ?? 1,
    remainingSeconds,
    remainingLabel: remainingSeconds === null ? "--:--" : formatTimer(remainingSeconds),
    progress,
    label: getPhaseLabel(room?.phase ?? "lobby", room?.isRunning ?? false)
  };
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function getPhaseLabel(phase: RoomPhase, isRunning: boolean) {
  if (phase === "lobby") {
    return "Ready to start";
  }

  if (phase === "focus") {
    return isRunning ? "Focus session" : "Focus paused";
  }

  if (phase === "break") {
    return isRunning ? "Break Lounge" : "Break paused";
  }

  return "Session ended";
}
