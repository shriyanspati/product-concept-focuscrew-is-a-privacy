import { z } from "zod";
import type { ScreenCheckExpectedContext } from "@/lib/types";

export const screenCheckSchema = z.object({
  goal: z.string().trim().min(1).max(240),
  subject: z.string().trim().max(80),
  expectedContexts: z.array(z.enum([
    "writing_notes",
    "research_pages",
    "calculator_coding",
    "video_lecture",
    "class_group_chat"
  ])).min(1).max(5),
  frameDataUrl: z.string()
    .max(350_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
});

export type ScreenCheckVisionOutput = {
  alignment: "aligned" | "unclear" | "likely_mismatch";
};

export function makeScreenCheckVisionPrompt(input: {
  goal: string;
  subject: string;
  expectedContexts: ScreenCheckExpectedContext[];
}) {
  return {
    system:
      "You are Soryvo's private study-alignment classifier. Inspect one low-resolution frame only for broad task alignment. Return strict JSON with one field: alignment. Allowed values: aligned, unclear, likely_mismatch. Be conservative: unfamiliar, ambiguous, loading, blank, messaging, or mixed screens are unclear unless clearly allowed by expected contexts. Never identify people, read private messages, infer sensitive traits, diagnose, shame, or mention other room members. Do not return confidence, screen details, app names, URLs, or extracted text.",
    user: JSON.stringify({
      goal: input.goal,
      subject: input.subject,
      expectedStudyContexts: input.expectedContexts,
      instruction: "Classify only whether the visible broad activity plausibly supports the declared goal."
    })
  };
}

export function normalizeScreenCheckVisionOutput(value: unknown): ScreenCheckVisionOutput {
  if (!value || typeof value !== "object") {
    return { alignment: "unclear" };
  }

  const alignment = (value as { alignment?: unknown }).alignment;
  return alignment === "aligned" || alignment === "likely_mismatch"
    ? { alignment }
    : { alignment: "unclear" };
}
