import { NextRequest, NextResponse } from "next/server";

import { runAskAiAgent } from "@/lib/ai/agent";
import { beginUserTurn, saveAssistantTurn } from "@/lib/ai/conversations";
import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const body = (await request.json()) as {
      question?: string;
      period?: string;
      conversationId?: string;
    };

    const question = body.question?.trim();
    if (!question) {
      return NextResponse.json(
        { ok: false, error: "Pergunta obrigatória." },
        { status: 400 }
      );
    }

    if (question.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "Pergunta muito longa." },
        { status: 400 }
      );
    }

    const turn = await beginUserTurn({
      userId: authResult.user.id,
      conversationId: body.conversationId,
      question,
    });

    if (!turn) {
      return NextResponse.json(
        { ok: false, error: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    const result = await runAskAiAgent({
      question,
      period: body.period,
      history: turn.history,
    });

    await saveAssistantTurn({
      conversationId: turn.conversationId,
      content: result.answer,
      toolsUsed: result.toolsUsed,
      usage: result.usage,
    });

    return NextResponse.json({
      ok: true,
      conversationId: turn.conversationId,
      answer: result.answer,
      toolsUsed: result.toolsUsed,
      usage: result.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no Humana Analytics";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status }
    );
  }
}
