"use client";

import { useEffect, useState } from "react";
import type { ActivityCategory } from "@/lib/types";

export type ExtensionActivitySignal = {
  connected: boolean;
  enabled: boolean;
  category: ActivityCategory;
  tabSwitchCount: number;
};

const initialSignal: ExtensionActivitySignal = {
  connected: false,
  enabled: false,
  category: "unknown",
  tabSwitchCount: 0
};

export function useExtensionActivitySignal() {
  const [signal, setSignal] = useState<ExtensionActivitySignal>(initialSignal);

  useEffect(() => {
    const receiveSignal = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== "soryvo-extension" ||
        event.data?.type !== "SORYVO_ACTIVITY_SIGNAL"
      ) {
        return;
      }

      setSignal(sanitizeSignal(event.data.signal));
    };

    window.addEventListener("message", receiveSignal);
    window.postMessage({ type: "SORYVO_REQUEST_ACTIVITY_SIGNAL" }, window.location.origin);

    return () => window.removeEventListener("message", receiveSignal);
  }, []);

  return signal;
}

function sanitizeSignal(value: unknown): ExtensionActivitySignal {
  const candidate = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const categories: ActivityCategory[] = [
    "study_tool",
    "writing_tool",
    "research_tool",
    "neutral_tool",
    "social_media",
    "idle",
    "unknown"
  ];
  const category = categories.includes(candidate.category as ActivityCategory)
    ? candidate.category as ActivityCategory
    : "unknown";
  const count = typeof candidate.tabSwitchCount === "number" && Number.isInteger(candidate.tabSwitchCount)
    ? Math.max(0, Math.min(999, candidate.tabSwitchCount))
    : 0;

  return {
    connected: true,
    enabled: candidate.enabled === true,
    category,
    tabSwitchCount: count
  };
}
