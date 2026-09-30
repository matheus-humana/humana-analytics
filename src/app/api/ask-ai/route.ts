import { NextRequest, NextResponse } from "next/server";

import { ChatAbortedError, runAskAiAgent } from "@/lib/ai/agent";
import {
  buildOutboundPayload,
  postAnalyticsBotWebhook,
  resolveAppBaseUrl,
} from "@/lib/ai/analytics-bot";
import {
  inferChatLocale,
  MISSING_ENGINE_MESSAGE,
  thinkingLabel,
  type ChatLocale,
} from "@/lib/ai/analytics-bot-contract";
import {
  beginUserTurn,
  clearConversationPending,
  markConversationPending,
  saveAssistantTurn,
} from "@/lib/ai/conversations";
import { currentEngine } from "@/lib/ai/engine";
import { checkChatRateLimit } from "@/lib/ai/rate-limit";
import { redactSensitive } from "@/lib/ai/redact";
import { toolNames } from "@/lib/ai/tool-trace";
import { emptyUsage, summarizeUsage } from "@/lib/ai/usage";
import { requireSessionUser } from "@/lib/auth/require-user";
import { isWorkspaceMessageKey, workspaceText } from "@/lib/i18n/workspace-copy";
import { loadGithubBridgeSummary } from "@/lib/github/chat";
import { loadSeoBridgeSummary } from "@/lib/seo/chat";

export const dynamic = "force-dynamic";

function copy(locale: ChatLocale, key: Parameters<typeof workspaceText>[1], values?: Record<string, string>) {
  const template = workspaceText(locale, key);
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
}

function errorText(locale: ChatLocale, error: unknown): string {
  const message = error instanceof Error ? error.message : "askFailed";
  if (isWorkspaceMessageKey(message)) return workspaceText(locale, message);
  return redactSensitive(message);
}

export async function POST(request: NextRequest) {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  let locale: ChatLocale = "pt-BR";

  try {
    const body = (await request.json()) as {
      question?: string;
      period?: string;
      conversationId?: string;
      locale?: string;
      projectId?: string;
    };

    const question = body.question?.trim() ?? "";
    locale = inferChatLocale(question, body.locale);

    if (!question) {
      return NextResponse.json(
        { ok: false, error: copy(locale, "questionRequired") },
        { status: 400 }
      );
    }

    if (question.length > 2000) {
      return NextResponse.json(
        { ok: false, error: copy(locale, "questionTooLong") },
        { status: 400 }
      );
    }

    const engine = currentEngine();
    if (engine.engine === "none") {
      return NextResponse.json(
        { ok: false, error: MISSING_ENGINE_MESSAGE },
        { status: 503 }
      );
    }

    const rate = await checkChatRateLimit(authResult.user.id);
    if (!rate.ok) {
      return NextResponse.json(
        { ok: false, error: copy(locale, "chatRateLimited", { limit: String(rate.limit) }) },
        { status: 429 }
      );
    }

    const turn = await beginUserTurn({
      userId: authResult.user.id,
      conversationId: body.conversationId,
      question,
      projectId: body.projectId,
      locale,
    });

    if (!turn) {
      return NextResponse.json(
        { ok: false, error: copy(locale, "conversationNotFound") },
        { status: 404 }
      );
    }

    if (engine.engine === "webhook") {
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
          locale,
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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        try {
          const result = await runAskAiAgent({
            question,
            period: body.period,
            history: turn.history,
            locale,
            projectId: turn.projectId,
            signal: request.signal,
            selection: engine,
            onDelta: (text) => send({ type: "delta", text }),
            onToolRound: () => send({ type: "reset" }),
          });
          await saveAssistantTurn({
            conversationId: turn.conversationId,
            content: result.answer,
            toolsUsed: result.toolsUsed,
            usage: result.usage,
            provider: result.provider,
            locale: result.locale,
            citations: result.citations,
            usedFallback: result.usedFallback,
          });
          send({
            type: "done",
            conversationId: turn.conversationId,
            answer: result.answer,
            toolsUsed: toolNames(result.toolsUsed),
            usage: result.usage,
            provider: result.provider,
            usedFallback: result.usedFallback,
          });
        } catch (error) {
          if (error instanceof ChatAbortedError) {
            if (error.partial.trim()) {
              await saveAssistantTurn({
                conversationId: turn.conversationId,
                content: error.partial,
                toolsUsed: [],
                usage: summarizeUsage("stopped", emptyUsage()),
                provider: engine.primary,
                locale,
                citations: [],
                usedFallback: false,
              });
            }
            return;
          }
          send({ type: "error", error: errorText(locale, error) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = errorText(locale, error);
    const status = message.includes("OPENAI_API_KEY") || message.includes("GEMINI_API_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
