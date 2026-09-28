import { NextRequest, NextResponse } from "next/server";

import { runAskAiAgent } from "@/lib/ai/agent";
import {
  buildOutboundPayload,
  postAnalyticsBotWebhook,
  resolveAppBaseUrl,
} from "@/lib/ai/analytics-bot";
import {
  MISSING_ENGINE_MESSAGE,
  selectReplyEngine,
  thinkingLabel,
} from "@/lib/ai/analytics-bot-contract";
import {
  beginUserTurn,
  clearConversationPending,
  markConversationPending,
  saveAssistantTurn,
} from "@/lib/ai/conversations";
import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";
import { workspaceCopy } from "@/lib/i18n/workspace-copy";
import { loadGithubBridgeSummary } from "@/lib/github/chat";
import { loadSeoBridgeSummary } from "@/lib/seo/chat";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const body = (await request.json()) as {
      question?: string;
      period?: string;
      conversationId?: string;
      locale?: string;
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

    const engine = selectReplyEngine({
      webhookUrl: process.env.ANALYTICS_BOT_WEBHOOK_URL,
      openAiKey: process.env.OPENAI_API_KEY,
    });

    if (engine === "webhook") {
      const payload = {
        ...buildOutboundPayload({
          conversationId: turn.conversationId,
          messageId: turn.messageId,
          userId: turn.userId,
          organizationId: turn.organizationId,
          projectId: turn.projectId,
          text: question,
          replyUrl: `${resolveAppBaseUrl(request.nextUrl.origin)}/api/analytics-bot/reply`,
          createdAt: turn.createdAt,
          locale: body.locale,
        }),
        github: await loadGithubBridgeSummary(),
        seo: await loadSeoBridgeSummary(),
      };
      const thinking = thinkingLabel(payload.locale);
      const pending = await markConversationPending({
        conversationId: turn.conversationId,
        replyToMessageId: turn.messageId,
        thinking,
      });

      if (pending.state === "answered") {
        return NextResponse.json({
          ok: true,
          pending: false,
          conversationId: turn.conversationId,
          answer: pending.answer,
          toolsUsed: ["analytics-bot"],
        });
      }

      const sent = await postAnalyticsBotWebhook(payload);
      if (!sent.ok) {
        await clearConversationPending({
          conversationId: turn.conversationId,
          replyToMessageId: turn.messageId,
        });
        return NextResponse.json(
          { ok: false, error: sent.error },
          { status: 502 }
        );
      }

      return NextResponse.json({
        ok: true,
        pending: true,
        conversationId: turn.conversationId,
        messageId: turn.messageId,
        thinking,
      });
    }

    if (engine === "none") {
      return NextResponse.json(
        { ok: false, error: MISSING_ENGINE_MESSAGE },
        { status: 503 }
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
      pending: false,
      conversationId: turn.conversationId,
      answer: result.answer,
      toolsUsed: result.toolsUsed,
      usage: result.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : workspaceCopy["pt-BR"].askFailed;
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status }
    );
  }
}
