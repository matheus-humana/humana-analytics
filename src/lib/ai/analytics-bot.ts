import { createHash, timingSafeEqual } from "node:crypto";

import { redactSensitive } from "./redact";
import {
  buildOutboundHeaders,
  WEBHOOK_REJECTED_MESSAGE,
  WEBHOOK_TIMEOUT_MESSAGE,
  WEBHOOK_UNREACHABLE_MESSAGE,
  inferChatLocale,
  type OutboundPayload,
} from "./analytics-bot-contract";

export function resolveAppBaseUrl(fallbackOrigin: string): string {
  const configured =
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    fallbackOrigin;
  return configured.replace(/\/+$/, "");
}

export type WebhookFetch = (url: string, init: RequestInit) => Promise<Response>;

const DEFAULT_WEBHOOK_TIMEOUT_MS = 10_000;

export function secretsMatch(provided: string, expected: string): boolean {
  const providedHash = createHash("sha256").update(provided, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return (
    timingSafeEqual(providedHash, expectedHash) &&
    provided.length > 0 &&
    expected.length > 0
  );
}

export function buildOutboundPayload(input: {
  conversationId: string;
  messageId: string;
  userId: string;
  organizationId: string;
  projectId: string;
  text: string;
  replyUrl: string;
  createdAt: string;
  locale?: string | null;
}): OutboundPayload {
  return {
    conversationId: input.conversationId,
    messageId: input.messageId,
    userId: input.userId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    locale: inferChatLocale(input.text, input.locale),
    text: redactSensitive(input.text, 2000),
    replyUrl: input.replyUrl,
    createdAt: input.createdAt,
  };
}

export async function postAnalyticsBotWebhook(
  payload: OutboundPayload,
  options?: {
    fetchImpl?: WebhookFetch;
    timeoutMs?: number;
    webhookUrl?: string;
    webhookSecret?: string | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = (
    options && "webhookUrl" in options
      ? options.webhookUrl
      : process.env.ANALYTICS_BOT_WEBHOOK_URL
  )?.trim() ?? "";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: WEBHOOK_UNREACHABLE_MESSAGE };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: WEBHOOK_UNREACHABLE_MESSAGE };
  }

  const secret =
    options && "webhookSecret" in options
      ? options.webhookSecret
      : process.env.ANALYTICS_BOT_WEBHOOK_SECRET;

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(parsed.toString(), {
      method: "POST",
      headers: buildOutboundHeaders(secret),
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error",
    });

    if (!response.ok) {
      console.error("[humana-analytics] analytics bot webhook rejected", {
        host: parsed.host,
        status: response.status,
      });
      return { ok: false, error: WEBHOOK_REJECTED_MESSAGE };
    }

    return { ok: true };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[humana-analytics] analytics bot webhook failed", {
      host: parsed.host,
      aborted,
    });
    return {
      ok: false,
      error: aborted ? WEBHOOK_TIMEOUT_MESSAGE : WEBHOOK_UNREACHABLE_MESSAGE,
    };
  } finally {
    clearTimeout(timer);
  }
}
