"use client";

import type { RoomConfig } from "@/lib/types";

const roomConfigKey = "soryvo:room-config";

export type RoomAdapter = {
  saveRoomConfig(config: RoomConfig): void;
  loadRoomConfig(roomCode?: string): RoomConfig | null;
  clearRoomConfig(roomCode?: string): void;
};

export const localRoomAdapter: RoomAdapter = {
  saveRoomConfig(config) {
    window.localStorage.setItem(roomConfigKey, JSON.stringify(config));
  },
  loadRoomConfig(roomCode) {
    const raw = window.localStorage.getItem(roomConfigKey);

    if (!raw) {
      return null;
    }

    try {
      const config = JSON.parse(raw) as RoomConfig;
      if (roomCode && config.roomCode.toUpperCase() !== roomCode.toUpperCase()) {
        return null;
      }

      return config;
    } catch {
      return null;
    }
  },
  clearRoomConfig(roomCode) {
    if (roomCode) {
      const saved = this.loadRoomConfig(roomCode);
      if (!saved) {
        return;
      }
    }
    window.localStorage.removeItem(roomConfigKey);
  }
};
