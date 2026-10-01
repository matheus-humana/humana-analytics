export const ASSISTANT_STATUS_IDLE = "idle";
export const ASSISTANT_STATUS_PENDING = "pending";

export const THINKING_PT = "Pensando…";
export const THINKING_EN = "Thinking…";

export const ANALYTICS_BOT_SOURCE = "analytics-bot";

export const MISSING_ENGINE_MESSAGE =
  "Humana Analytics não tem um motor de resposta configurado. Defina CHAT_ENGINE=native com GEMINI_API_KEY (ou GROQ_API_KEY ou OPENAI_API_KEY), ou CHAT_ENGINE=bridge com ANALYTICS_BOT_WEBHOOK_URL. Nenhuma métrica foi consultada nem estimada.";

export const WEBHOOK_REJECTED_MESSAGE =
  "O Analytics Bot recusou a pergunta. Nenhuma métrica foi inventada.";

export const WEBHOOK_UNREACHABLE_MESSAGE =
  "Não foi possível contactar o Analytics Bot. Nenhuma métrica foi inventada.";

export const WEBHOOK_TIMEOUT_MESSAGE =
  "O Analytics Bot não confirmou o envio a tempo. Nenhuma métrica foi inventada.";

export type ChatLocale = "pt-BR" | "en";

export type ReplyEngine = "webhook" | "openai" | "native" | "none";

export type ProviderId = "gemini" | "groq" | "openai";

export type EngineSelection = {
  engine: ReplyEngine;
  primary: ProviderId | null;
  fallback: ProviderId | null;
};

export type ChatEngineEnv = {
  webhookUrl?: string | null;
  openAiKey?: string | null;
  chatEngine?: string | null;
  geminiKey?: string | null;
  groqKey?: string | null;
  primary?: string | null;
  fallback?: string | null;
};

export type OutboundPayload = {
  conversationId: string;
  messageId: string;
  userId: string;
  organizationId: string;
  projectId: string;
  locale: ChatLocale;
  text: string;
  replyUrl: string;
  createdAt: string;
  /** Aggregated GitHub snapshots when the bridge is used. Omitted by older callers. */
  github?: unknown;
  /** Aggregated SEO/GEO snapshots and GA4 AI-referral totals. Omitted by older callers. */
  seo?: unknown;
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const IMAGE_URL_LINE =
  /^https:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?$/i;
const MAX_REPLY_CHARS = 16_000;
const MAX_IMAGE_URLS = 4;

export function isThinkingPlaceholder(content: string): boolean {
  return content === THINKING_PT || content === THINKING_EN;
}

export function thinkingLabel(locale: ChatLocale): string {
  return locale === "en" ? THINKING_EN : THINKING_PT;
}

export function normalizeChatLocale(value?: string | null): ChatLocale | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "en" || normalized === "en-us") return "en";
  if (normalized === "pt" || normalized === "pt-br") return "pt-BR";
  return null;
}

export function inferChatLocale(text: string, explicit?: string | null): ChatLocale {
  const fromExplicit = normalizeChatLocale(explicit);
  if (fromExplicit) return fromExplicit;

  const portuguese =
    /[áàâãéêíóôõúç]/i.test(text) ||
    /\b(não|nao|quantos|quais|tráfego|trafego|usuários|usuarios|período|periodo|últimos|ultimos|de onde|visitantes)\b/i.test(
      text
    );
  const english =
    /\b(where|what|how|many|visitors|users|sessions|traffic|from|did|our)\b/i.test(
      text
    );

  if (english && !portuguese) return "en";
  return "pt-BR";
}

function trimmed(value?: string | null): string {
  return value?.trim() ?? "";
}

function normalizeProvider(value?: string | null): ProviderId | null {
  const text = trimmed(value).toLowerCase();
  if (text === "gemini" || text === "groq" || text === "openai") return text;
  return null;
}

export function hasProviderKey(id: ProviderId, env: ChatEngineEnv): boolean {
  if (id === "gemini") return Boolean(trimmed(env.geminiKey));
  if (id === "groq") return Boolean(trimmed(env.groqKey));
  return Boolean(trimmed(env.openAiKey));
}

function resolveNative(
  env: ChatEngineEnv
): { primary: ProviderId; fallback: ProviderId | null } | null {
  const available = (["gemini", "groq", "openai"] as const).filter((id) =>
    hasProviderKey(id, env)
  );
  if (available.length === 0) return null;

  const requestedPrimary = normalizeProvider(env.primary);
  const primary =
    requestedPrimary && hasProviderKey(requestedPrimary, env)
      ? requestedPrimary
      : available[0];

  const requestedFallback = normalizeProvider(env.fallback);
  if (
    requestedFallback &&
    requestedFallback !== primary &&
    hasProviderKey(requestedFallback, env)
  ) {
    return { primary, fallback: requestedFallback };
  }
  if (trimmed(env.fallback)) return { primary, fallback: null };

  const next = available.find((id) => id !== primary) ?? null;
  return { primary, fallback: next };
}

function nativeSelection(
  native: { primary: ProviderId; fallback: ProviderId | null }
): EngineSelection {
  return {
    engine: native.primary === "openai" && !native.fallback ? "openai" : "native",
    primary: native.primary,
    fallback: native.fallback,
  };
}

/**
 * CHAT_ENGINE=bridge uses the Analytics Bot webhook.
 * CHAT_ENGINE=native uses AI_PROVIDER_PRIMARY (default Gemini) and
 * AI_PROVIDER_FALLBACK (default the next configured provider, usually Groq).
 * Unset CHAT_ENGINE keeps the previous order: webhook, then a configured provider.
 */
export function resolveChatEngine(env: ChatEngineEnv): EngineSelection {
  const mode = trimmed(env.chatEngine).toLowerCase();
  const webhook = Boolean(trimmed(env.webhookUrl));
  const native = resolveNative(env);

  if (mode === "bridge") {
    return { engine: webhook ? "webhook" : "none", primary: null, fallback: null };
  }
  if (mode === "native") {
    return native
      ? nativeSelection(native)
      : { engine: "none", primary: null, fallback: null };
  }
  if (webhook) return { engine: "webhook", primary: null, fallback: null };
  if (!native) return { engine: "none", primary: null, fallback: null };
  return nativeSelection(native);
}

/**
 * Puts the model picked in the chat first. The previous primary becomes the
 * fallback. Unknown or keyless providers and the webhook bridge are left as is.
 */
export function preferProvider(
  selection: EngineSelection,
  requested: string | null | undefined,
  env: ChatEngineEnv
): EngineSelection {
  const provider = normalizeProvider(requested);
  if (!provider || !hasProviderKey(provider, env)) return selection;
  if (selection.engine !== "native" && selection.engine !== "openai") return selection;
  if (provider === selection.primary) return selection;
  const fallback = selection.primary ?? selection.fallback;
  return {
    engine: "native",
    primary: provider,
    fallback: fallback === provider ? null : fallback,
  };
}

export function selectReplyEngine(env: ChatEngineEnv): ReplyEngine {
  return resolveChatEngine(env).engine;
}

export function buildOutboundHeaders(
  secret?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const trimmed = secret?.trim();
  if (trimmed) {
    headers.Authorization = `Bearer ${trimmed}`;
    headers["X-Analytics-Bot-Key"] = trimmed;
  }
  return headers;
}

type HeadersLike = {
  get(name: string): string | null;
};

/**
 * Reads the callback secret from Authorization: Bearer or
 * X-Analytics-Bot-Reply-Secret. When both are present they must match.
 */
export function readReplySecret(headers: HeadersLike): string | null {
  const authorization = headers.get("authorization")?.trim() ?? "";
  const custom = headers.get("x-analytics-bot-reply-secret")?.trim() ?? "";
  const bearerMatch = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  const bearer = bearerMatch?.[1] ?? "";
  if (bearer && custom && bearer !== custom) return null;
  return bearer || custom || null;
}

export function isSafeId(value: string): boolean {
  return ID_PATTERN.test(value);
}

export type ParsedReply = {
  conversationId: string;
  messageId: string | null;
  text: string;
  source: string;
  userId: string | null;
  organizationId: string | null;
  projectId: string | null;
  imageUrls: string[];
};

export function parseReplyBody(
  body: unknown
): { ok: true; reply: ParsedReply } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "JSON object body required." };
  }

  const record = body as Record<string, unknown>;
  const conversationId = readRequiredId(record.conversationId, "conversationId");
  if (!conversationId.ok) return conversationId;

  if (typeof record.text !== "string" || !record.text.trim()) {
    return { ok: false, error: "text is required." };
  }
  const text = record.text.trim();
  if (text.length > MAX_REPLY_CHARS) {
    return { ok: false, error: "text is too long." };
  }

  const messageId = readOptionalId(record.messageId, "messageId");
  if (!messageId.ok) return messageId;
  const userId = readOptionalId(record.userId, "userId");
  if (!userId.ok) return userId;
  const organizationId = readOptionalId(record.organizationId, "organizationId");
  if (!organizationId.ok) return organizationId;
  const projectId = readOptionalId(record.projectId, "projectId");
  if (!projectId.ok) return projectId;

  return {
    ok: true,
    reply: {
      conversationId: conversationId.id,
      messageId: messageId.id,
      text,
      source: readSource(record.source),
      userId: userId.id,
      organizationId: organizationId.id,
      projectId: projectId.id,
      imageUrls: readImageUrls(record),
    },
  };
}

export function assertReplyOwnership(input: {
  conversationUserId: string;
  conversationProjectId: string;
  conversationOrganizationId: string;
  userId: string | null;
  projectId: string | null;
  organizationId: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (input.userId && input.userId !== input.conversationUserId) {
    return { ok: false, error: "userId does not match this conversation." };
  }
  if (input.projectId && input.projectId !== input.conversationProjectId) {
    return { ok: false, error: "projectId does not match this conversation." };
  }
  if (
    input.organizationId &&
    input.organizationId !== input.conversationOrganizationId
  ) {
    return {
      ok: false,
      error: "organizationId does not match this conversation.",
    };
  }
  return { ok: true };
}

export function composeAssistantContent(text: string, imageUrls: string[]): string {
  if (imageUrls.length === 0) return text;
  return `${text}\n\n${imageUrls.join("\n")}`;
}

export function splitAssistantContent(content: string): {
  text: string;
  images: string[];
} {
  const images: string[] = [];
  const kept: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (IMAGE_URL_LINE.test(trimmed)) {
      images.push(trimmed);
      continue;
    }
    kept.push(line);
  }

  return {
    text: kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd(),
    images,
  };
}

export function replyWritePlan(existingContent: string | null): "insert" | "replace" | "duplicate" {
  if (existingContent == null) return "insert";
  if (isThinkingPlaceholder(existingContent)) return "replace";
  return "duplicate";
}

function readRequiredId(
  value: unknown,
  field: string
): { ok: true; id: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !isSafeId(value.trim())) {
    return { ok: false, error: `${field} is required.` };
  }
  return { ok: true, id: value.trim() };
}

function readOptionalId(
  value: unknown,
  field: string
): { ok: true; id: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, id: null };
  if (typeof value !== "string" || !isSafeId(value.trim())) {
    return { ok: false, error: `${field} is invalid.` };
  }
  return { ok: true, id: value.trim() };
}

function readSource(value: unknown): string {
  if (typeof value !== "string") return ANALYTICS_BOT_SOURCE;
  const cleaned = value.trim().replace(/[^\w.-]/g, "").slice(0, 40);
  return cleaned || ANALYTICS_BOT_SOURCE;
}

function readImageUrls(record: Record<string, unknown>): string[] {
  const raw: unknown[] = [];
  if (Array.isArray(record.imageUrls)) raw.push(...record.imageUrls);
  if (Array.isArray(record.attachments)) {
    for (const item of record.attachments) {
      if (typeof item === "string") raw.push(item);
      else if (item && typeof item === "object" && "url" in item) {
        raw.push((item as { url: unknown }).url);
      }
    }
  }

  const urls: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!isSafeHttpsUrl(url)) continue;
    urls.push(url);
    if (urls.length >= MAX_IMAGE_URLS) break;
  }
  return urls;
}

function isSafeHttpsUrl(url: string): boolean {
  if (url.length > 2000) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
