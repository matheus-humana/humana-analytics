import { NextRequest, NextResponse } from "next/server";

import { secretsMatch } from "@/lib/ai/analytics-bot";
import { parseReplyBody, readReplySecret } from "@/lib/ai/analytics-bot-contract";
import { appendAnalyticsBotReply } from "@/lib/ai/conversations";
import { redactSensitive } from "@/lib/ai/redact";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.ANALYTICS_BOT_REPLY_SECRET?.trim() ?? "";
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Analytics Bot reply secret is not configured." },
      { status: 503 }
    );
  }

  const provided = readReplySecret(request.headers);
  if (!provided || !secretsMatch(provided, expected)) {
    console.error("[humana-analytics] rejected analytics bot reply");
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON object body required." },
      { status: 400 }
    );
  }

  const parsed = parseReplyBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const result = await appendAnalyticsBotReply(parsed.reply);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save reply";
    console.error("[humana-analytics] analytics bot reply failed");
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status: 500 }
    );
  }
}
