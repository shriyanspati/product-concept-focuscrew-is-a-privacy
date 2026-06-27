import type { FocusCoachInput, FocusCoachOutput } from "@/lib/types";

const systemRules = [
  "Never shame the user.",
  "Never diagnose a condition.",
  "Never mention attention disorders.",
  "Never guilt users for taking breaks.",
  "Keep messages under 35 words.",
  "Give one concrete next action.",
  "Do not reveal any individual group member data.",
  "Use supportive teen-friendly language without sounding childish."
].join(" ");

export function getFallbackFocusCoach(input: FocusCoachInput): FocusCoachOutput {
  const goal = input.userGoal.trim() || "your current study task";
  const subject = input.subject.trim() || "study session";
  const lastSignal = input.recentActivitySignals.at(-1) ?? input.userSelectedState;
  const isLowFocus = input.groupFocusScore < 55 || input.groupDriftCount >= 2;
  const firstAction = makeMicroTask(goal, subject);

  if (lastSignal === "need_break" || input.userSelectedState === "need_break") {
    return {
      status: "break_recommended",
      confidence: 0.88,
      privateMessage:
        "An intentional break can protect your study flow. Set a short timer, stand up, and come back to one clear next step.",
      groupMessage: "A shared reset may help. Take three quiet minutes, then restart with one tiny action.",
      suggestedAction: "Take a three-minute intentional break",
      microTask: firstAction,
      tone: "calm"
    };
  }

  if (lastSignal === "stuck" || input.userSelectedState === "stuck") {
    return {
      status: "stuck",
      confidence: 0.84,
      privateMessage:
        "This task may be too broad. Rewrite it as one action you can finish in five minutes.",
      groupMessage: isLowFocus ? "The room may benefit from a two-minute silent reset before continuing." : null,
      suggestedAction: "Break the task into a five-minute first move",
      microTask: firstAction,
      tone: "encouraging"
    };
  }

  if (lastSignal === "back_on_track" || lastSignal === "reset_started") {
    return {
      status: "recovering",
      confidence: 0.91,
      privateMessage:
        "You are back on track. Nice recovery. Momentum matters more than perfection.",
      groupMessage: "Reset started. Everyone gets one quiet minute, then the next tiny action.",
      suggestedAction: "Restart with one visible step",
      microTask: firstAction,
      tone: "celebratory"
    };
  }

  if (isLowFocus || ["task_switch", "long_idle", "group_drift"].includes(lastSignal)) {
    return {
      status: "drifting",
      confidence: 0.86,
      privateMessage:
        "Your room's focus is dipping. Try a two-minute silent reset together.",
      groupMessage: "Focus dip detected. Want to start a three-minute group lock-in?",
      suggestedAction: "Start a short group lock-in",
      microTask: firstAction,
      tone: "calm"
    };
  }

  return {
    status: "focused",
    confidence: 0.9,
    privateMessage: `You have been focused for ${input.focusedMinutes} minutes. Keep the next step tiny: ${firstAction}.`,
    groupMessage: null,
    suggestedAction: "Protect the next five minutes",
    microTask: firstAction,
    tone: "encouraging"
  };
}

export async function requestFocusCoach(input: FocusCoachInput): Promise<FocusCoachOutput> {
  const response = await fetch("/api/focus-coach", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    return getFallbackFocusCoach(input);
  }

  return (await response.json()) as FocusCoachOutput;
}

export function makeCoachPrompt(input: FocusCoachInput) {
  return {
    system: `You are Soryvo's privacy-first study coach. ${systemRules} Return strict JSON only with keys: status, confidence, privateMessage, groupMessage, suggestedAction, microTask, tone.`,
    user: JSON.stringify({
      userGoal: input.userGoal,
      subject: input.subject,
      sessionDuration: input.sessionDuration,
      focusedMinutes: input.focusedMinutes,
      recentActivitySignals: input.recentActivitySignals,
      groupFocusScore: input.groupFocusScore,
      groupDriftCount: input.groupDriftCount,
      userSelectedState: input.userSelectedState,
      energyLevel: input.energyLevel ?? "steady",
      privacyBoundary:
        "Only aggregate focus signals and task labels are available. No screenshots, URLs, messages, passwords, browser history, webcam, microphone, or keystrokes."
    })
  };
}

export function normalizeCoachOutput(value: unknown, fallback: FocusCoachInput): FocusCoachOutput {
  const backup = getFallbackFocusCoach(fallback);

  if (!value || typeof value !== "object") {
    return backup;
  }

  const candidate = value as Partial<FocusCoachOutput>;
  const validStatus = ["focused", "drifting", "stuck", "break_recommended", "recovering"];
  const validTone = ["encouraging", "calm", "celebratory"];

  return {
    status: validStatus.includes(candidate.status ?? "") ? candidate.status as FocusCoachOutput["status"] : backup.status,
    confidence:
      typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
        ? Math.max(0, Math.min(1, candidate.confidence))
        : backup.confidence,
    privateMessage: sanitizeMessage(candidate.privateMessage, backup.privateMessage),
    groupMessage:
      typeof candidate.groupMessage === "string" && candidate.groupMessage.trim().length > 0
        ? trimWords(candidate.groupMessage, 35)
        : null,
    suggestedAction: sanitizeMessage(candidate.suggestedAction, backup.suggestedAction),
    microTask: sanitizeMessage(candidate.microTask, backup.microTask),
    tone: validTone.includes(candidate.tone ?? "") ? candidate.tone as FocusCoachOutput["tone"] : backup.tone
  };
}

function sanitizeMessage(value: unknown, backup: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return backup;
  }

  return trimWords(value, 35);
}

function trimWords(value: string, maxWords: number) {
  const words = value.trim().split(/\s+/);
  return words.length <= maxWords ? value.trim() : `${words.slice(0, maxWords).join(" ")}.`;
}

function makeMicroTask(goal: string, subject: string) {
  const lowerGoal = goal.toLowerCase();

  if (lowerGoal.includes("essay") || lowerGoal.includes("outline")) {
    return "write the next topic sentence";
  }

  if (lowerGoal.includes("math") || lowerGoal.includes("problem")) {
    return "solve one problem and mark the step that slowed you down";
  }

  if (lowerGoal.includes("notes") || lowerGoal.includes("biology")) {
    return "summarize one concept in your own words";
  }

  if (lowerGoal.includes("read")) {
    return "read two paragraphs and write one margin note";
  }

  if (subject.toLowerCase().includes("language")) {
    return "practice five vocabulary cards";
  }

  return "finish one specific five-minute action";
}
