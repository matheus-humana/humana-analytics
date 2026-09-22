import { NextRequest, NextResponse } from "next/server";

import { runAskAiAgent } from "@/lib/ai/agent";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: string;
      period?: string;
    };

    const question = body.question?.trim();
    if (!question) {
      return NextResponse.json(
        { ok: false, error: "Pergunta obrigatória." },
        { status: 400 }
      );
    }

    const result = await runAskAiAgent({
      question,
      period: body.period,
    });

    return NextResponse.json({
      ok: true,
      answer: result.answer,
      toolsUsed: result.toolsUsed,
      usage: result.usage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha no Ask AI";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
