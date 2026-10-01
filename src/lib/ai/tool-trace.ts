import { redactSensitive } from "./redact";

export type Citation = {
  source: string;
  period: string | null;
  retrievedAt: string;
  /** Set for web pages; `source` is then the page title. */
  url?: string;
};

export type ToolCallRecord = {
  name: string;
  args: Record<string, string>;
  source: string | null;
  period: string | null;
  ok: boolean;
  durationMs: number;
};

const ARRAY_LIMIT = 8;
const STRING_LIMIT = 280;
const ARG_KEYS = ["period", "dimension"] as const;
/** Web search clips snippets at the source; cutting a URL would break the link. */
const UNCLIPPED_KEYS = new Set(["url", "snippet"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function safeToolArgs(raw: string): Record<string, string> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    if (!isRecord(parsed)) return {};
    const args: Record<string, string> = {};
    for (const key of ARG_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value.length > 0 && value.length <= 40) {
        args[key] = value;
      }
    }
    return args;
  } catch {
    return {};
  }
}

export function attachCitation(result: unknown, retrievedAt: string): unknown {
  if (!isRecord(result)) {
    return {
      source: "unknown",
      citation: { source: "unknown", period: null, retrievedAt },
    };
  }
  if (isRecord(result.citation) && typeof result.citation.source === "string") {
    return result;
  }

  const source = typeof result.source === "string" ? result.source : "unknown";
  let period: string | null = null;
  if (result.connected === false) period = "not-connected";
  else if (result.comparison === true && typeof result.periodId === "string") {
    period = `${result.periodId} vs previous`;
  } else if (typeof result.periodId === "string") period = result.periodId;
  else if (typeof result.period === "string") period = result.period;

  return {
    ...result,
    citation: { source, period, retrievedAt } satisfies Citation,
  };
}

export function readCitation(result: unknown): Citation | null {
  if (!isRecord(result) || !isRecord(result.citation)) return null;
  const source = result.citation.source;
  const retrievedAt = result.citation.retrievedAt;
  if (typeof source !== "string" || typeof retrievedAt !== "string") return null;
  const period =
    typeof result.citation.period === "string" ? result.citation.period : null;
  return { source, period, retrievedAt };
}

/** One citation per web page for search results, otherwise the tool's single citation. */
export function readCitations(result: unknown): Citation[] {
  const citation = readCitation(result);
  if (!citation) return [];
  if (!isRecord(result) || result.web !== true || !Array.isArray(result.results)) {
    return [citation];
  }
  const pages: Citation[] = [];
  for (const item of result.results) {
    if (!isRecord(item) || typeof item.url !== "string") continue;
    const title = typeof item.title === "string" && item.title ? item.title : item.url;
    pages.push({ source: title, period: null, retrievedAt: citation.retrievedAt, url: item.url });
  }
  return pages;
}

export function resultOk(result: unknown): boolean {
  if (!isRecord(result)) return false;
  if (result.connected === false) return false;
  if (typeof result.error === "string") return false;
  return result.connected === true || result.qualitative === true;
}

export function disconnectedSource(result: unknown): string | null {
  if (!isRecord(result) || result.connected !== false) return null;
  return typeof result.source === "string" ? result.source : null;
}

function redactDeep(value: unknown): unknown {
  if (typeof value === "string") return redactSensitive(value, value.length);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item));
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) next[key] = redactDeep(child);
  return next;
}

function compactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > STRING_LIMIT ? `${value.slice(0, STRING_LIMIT)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, ARRAY_LIMIT).map((item) => compactValue(item));
  }
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = UNCLIPPED_KEYS.has(key) && typeof child === "string" ? child : compactValue(child);
  }
  return next;
}

/** Drop raw bulk from a tool payload before it reaches the model. */
export function prepareToolResult(result: unknown, retrievedAt: string): unknown {
  return compactValue(redactDeep(attachCitation(result, retrievedAt)));
}

export function toolNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item) names.push(item);
    else if (isRecord(item) && typeof item.name === "string" && item.name) {
      names.push(item.name);
    }
  }
  return names;
}
