import { z } from "zod";
import type {
  ActivityCategory,
  FocusCheckInput,
  FocusCheckResult,
  FocusCheckSelfReport,
  FocusCheckStoredState,
  ParticipantStatus
} from "@/lib/types";

export const focusCheckSchema = z.object({
  goal: z.string().trim().min(1).max(240),
  subject: z.string().trim().max(80).optional(),
  selfReport: z.enum(["on_task", "stuck", "taking_break", "skipped"]),
  currentActivity: z.string().trim().max(180).optional(),
  nextTinyStep: z.string().trim().max(180).optional(),
  blocker: z.string().trim().max(180).optional(),
  activityCategory: z
    .enum(["study_tool", "writing_tool", "research_tool", "neutral_tool", "social_media", "idle", "unknown"])
    .optional()
});

export function getFallbackFocusCheck(input: FocusCheckInput): FocusCheckResult {
  const category = input.activityCategory ?? "unknown";

  if (input.selfReport === "taking_break") {
    return {
      alignment: "uncertain",
      privateStatus: "break",
      confidence: 0.86,
      message: "Intentional breaks protect momentum. Set a short timer and return to one visible next step.",
      suggestedAction: "Take three minutes, then restart with your smallest next action."
    };
  }

  if (input.selfReport === "stuck") {
    return {
      alignment: "needs_reset",
      privateStatus: "stuck",
      confidence: 0.88,
      message: "You hit friction, not failure. Start with the smallest possible action.",
      suggestedAction: makeStuckSuggestion(input.blocker, input.goal)
    };
  }

  if (input.selfReport === "skipped") {
    return {
      alignment: "uncertain",
      privateStatus: "focused",
      confidence: 0.55,
      message: "Check skipped. You can pause sharing and return when you are ready.",
      suggestedAction: "Resume with one clear next step when you want to share status again."
    };
  }

  if (category === "social_media" || category === "idle") {
    return {
      alignment: "needs_reset",
      privateStatus: "stuck",
      confidence: 0.78,
      message: "The current activity signal may not support your goal. Try a quick reset before continuing.",
      suggestedAction: "Close the loop with one five-minute task-alignment reset."
    };
  }

  const activity = input.currentActivity ?? "";
  const step = input.nextTinyStep ?? "";
  const relevance = scoreTextOverlap(input.goal, `${activity} ${step} ${input.subject ?? ""}`);
  const vague = isVague(activity) || isVague(step);

  if (vague) {
    return {
      alignment: "uncertain",
      privateStatus: "focused",
      confidence: 0.62,
      message: "Your next step may be too broad. Pick one action you can finish in five minutes.",
      suggestedAction: "Rewrite your next step as a single visible action."
    };
  }

  if (relevance < 0.12) {
    return {
      alignment: "uncertain",
      privateStatus: "focused",
      confidence: 0.61,
      message: "Your answer is close, but the goal link is unclear. Tighten the next step.",
      suggestedAction: "Name the exact part of your goal this next action supports."
    };
  }

  return {
    alignment: "clear",
    privateStatus: "focused",
    confidence: 0.9,
    message: "You are anchored. Finish that next step before switching tasks.",
    suggestedAction: "Protect the next five minutes for that single step."
  };
}

export async function requestFocusCheck(input: FocusCheckInput): Promise<FocusCheckResult> {
  const response = await fetch("/api/focus-check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    return getFallbackFocusCheck(input);
  }

  return (await response.json()) as FocusCheckResult;
}

export function mapFocusCheckToPublicStatus(input: {
  selfReport: FocusCheckSelfReport;
  result?: FocusCheckResult;
}): ParticipantStatus {
  if (input.selfReport === "skipped") {
    return "not_sharing_activity";
  }

  if (input.selfReport === "taking_break" || input.result?.privateStatus === "break") {
    return "taking_break";
  }

  if (input.selfReport === "stuck" || input.result?.alignment === "needs_reset") {
    return "needs_reset";
  }

  return "focused";
}

export function mapFocusCheckToStoredState(input: {
  selfReport: FocusCheckSelfReport;
  result?: FocusCheckResult;
}): FocusCheckStoredState {
  if (input.selfReport === "skipped") {
    return "skipped";
  }

  if (input.selfReport === "taking_break" || input.result?.privateStatus === "break") {
    return "break";
  }

  if (input.selfReport === "stuck" || input.result?.alignment === "needs_reset") {
    return "needs_reset";
  }

  return input.result?.alignment ?? "uncertain";
}

export function makeFocusCheckPrompt(input: FocusCheckInput) {
  return {
    system:
      "You are Soryvo's private Focus Check coach. Return strict JSON with alignment, privateStatus, confidence, message, suggestedAction. Never shame, diagnose, mention attention disorders, guilt breaks, or refer to other participants. Keep message under 30 words. Give one concrete next action.",
    user: JSON.stringify({
      goal: input.goal,
      subject: input.subject ?? "Study session",
      selfReport: input.selfReport,
      currentActivity: input.currentActivity ?? "",
      nextTinyStep: input.nextTinyStep ?? "",
      blocker: input.blocker ?? "",
      activityCategory: input.activityCategory ?? "unknown",
      privacyBoundary:
        "Only self-reported task-alignment text and optional broad activity category are available. No screenshots, URLs, page titles, messages, browser history, keystrokes, camera, microphone, or room member data."
    })
  };
}

export function normalizeFocusCheckOutput(value: unknown, fallbackInput: FocusCheckInput): FocusCheckResult {
  const backup = getFallbackFocusCheck(fallbackInput);

  if (!value || typeof value !== "object") {
    return backup;
  }

  const candidate = value as Partial<FocusCheckResult>;
  const alignments = ["clear", "uncertain", "needs_reset"];
  const privateStatuses = ["focused", "stuck", "break"];

  return {
    alignment: alignments.includes(candidate.alignment ?? "") ? candidate.alignment as FocusCheckResult["alignment"] : backup.alignment,
    privateStatus: privateStatuses.includes(candidate.privateStatus ?? "") ? candidate.privateStatus as FocusCheckResult["privateStatus"] : backup.privateStatus,
    confidence:
      typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : backup.confidence,
    message: sanitize(candidate.message, backup.message),
    suggestedAction: sanitize(candidate.suggestedAction, backup.suggestedAction)
  };
}

function sanitize(value: unknown, backup: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return backup;
  }

  return trimWords(value, 30);
}

function trimWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/);
  return words.length <= maxWords ? value.trim() : `${words.slice(0, maxWords).join(" ")}.`;
}

function isVague(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length < 4 || /^(study|working|homework|stuff|notes|review)$/i.test(value.trim());
}

function scoreTextOverlap(goal: string, response: string) {
  const goalWords = keywords(goal);
  const responseWords = keywords(response);

  if (goalWords.length === 0 || responseWords.length === 0) {
    return 0;
  }

  const responseSet = new Set(responseWords);
  const matches = goalWords.filter((word) => responseSet.has(word));
  return matches.length / goalWords.length;
}

function keywords(value: string) {
  const stop = new Set(["the", "and", "for", "with", "this", "that", "your", "you", "are", "one", "two", "from"]);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word));
}

function makeStuckSuggestion(blocker: string | undefined, goal: string) {
  const text = `${blocker ?? ""} ${goal}`.toLowerCase();

  if (text.includes("math") || text.includes("problem") || text.includes("equation")) {
    return "Start by writing the known values from the problem. Do only that first.";
  }

  if (text.includes("essay") || text.includes("outline") || text.includes("history")) {
    return "Write one rough sentence for the next section before editing anything.";
  }

  if (text.includes("biology") || text.includes("notes")) {
    return "Pick one concept and explain it in your own words in two sentences.";
  }

  return "Choose the smallest visible step and do only that for five minutes.";
}

export function getDefaultActivityCategory(): ActivityCategory {
  return "unknown";
}
