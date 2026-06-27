import { NextResponse } from "next/server";
import {
  getFallbackFocusCoach,
  makeCoachPrompt,
  normalizeCoachOutput
} from "@/lib/focusCoach";
import type { FocusCoachInput } from "@/lib/types";

export async function POST(request: Request) {
  let input: FocusCoachInput;

  try {
    input = (await request.json()) as FocusCoachInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(getFallbackFocusCoach(input));
  }

  try {
    const prompt = makeCoachPrompt(input);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: prompt.system
          },
          {
            role: "user",
            content: prompt.user
          }
        ],
        text: {
          format: {
            type: "json_object"
          }
        }
      })
    });

    if (!response.ok) {
      return NextResponse.json(getFallbackFocusCoach(input));
    }

    const data = await response.json() as OpenAIResponse;
    const outputText = extractOutputText(data);
    const parsed = outputText ? JSON.parse(outputText) : null;

    return NextResponse.json(normalizeCoachOutput(parsed, input));
  } catch {
    return NextResponse.json(getFallbackFocusCoach(input));
  }
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

function extractOutputText(data: OpenAIResponse) {
  if (data.output_text) {
    return data.output_text;
  }

  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => Boolean(text));
}
