import { NextResponse } from "next/server";
import {
  makeScreenCheckVisionPrompt,
  normalizeScreenCheckVisionOutput,
  screenCheckSchema
} from "@/lib/screenCheckService";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  return NextResponse.json(
    { cloudAvailable: Boolean(process.env.OPENAI_API_KEY) },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Cloud vision is not configured." }, { status: 503, headers: noStoreHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: noStoreHeaders });
  }

  const parsed = screenCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid private screen check request." }, { status: 400, headers: noStoreHeaders });
  }

  const prompt = makeScreenCheckVisionPrompt(parsed.data);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `${prompt.system}\n\n${prompt.user}` },
            { type: "input_image", image_url: parsed.data.frameDataUrl, detail: "low" }
          ]
        }],
        text: { format: { type: "json_object" } }
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ alignment: "unclear" }, { headers: noStoreHeaders });
    }

    const data = await response.json() as OpenAIResponse;
    const outputText = extractOutputText(data);
    const candidate = outputText ? JSON.parse(outputText) : null;
    return NextResponse.json(normalizeScreenCheckVisionOutput(candidate), { headers: noStoreHeaders });
  } catch {
    return NextResponse.json({ alignment: "unclear" }, { headers: noStoreHeaders });
  }
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

function extractOutputText(data: OpenAIResponse) {
  return data.output_text ?? data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text): text is string => Boolean(text));
}
