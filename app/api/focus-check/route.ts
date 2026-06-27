import { NextResponse } from "next/server";
import {
  focusCheckSchema,
  getFallbackFocusCheck,
  makeFocusCheckPrompt,
  normalizeFocusCheckOutput
} from "@/lib/focusCheckService";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = focusCheckSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Focus Check request" }, { status: 400 });
  }

  const input = parsed.data;
  const headers = {
    "Cache-Control": "no-store, max-age=0"
  };
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(getFallbackFocusCheck(input), { headers });
  }

  try {
    const prompt = makeFocusCheckPrompt(input);
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
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json(getFallbackFocusCheck(input), { headers });
    }

    const data = await response.json() as OpenAIResponse;
    const outputText = extractOutputText(data);
    const candidate = outputText ? JSON.parse(outputText) : null;

    return NextResponse.json(normalizeFocusCheckOutput(candidate, input), { headers });
  } catch {
    return NextResponse.json(getFallbackFocusCheck(input), { headers });
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
