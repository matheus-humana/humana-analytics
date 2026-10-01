const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const QUERY_LIMIT = 300;
const SNIPPET_LIMIT = 600;
const MAX_RESULTS = 5;
const TIMEOUT_MS = 12_000;

export const WEB_RECENCY = ["day", "week", "month", "year"] as const;
export type WebRecency = (typeof WEB_RECENCY)[number];

export type WebSearchConfig =
  | { ok: true; mode: "key"; apiKey: string }
  | { ok: true; mode: "keyless" }
  | { ok: false };

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string | null;
};

type WebSearchEnv = Partial<Record<"TAVILY_API_KEY" | "WEB_SEARCH_KEYLESS", string>>;

/**
 * TAVILY_API_KEY enables search with the account's monthly credits.
 * WEB_SEARCH_KEYLESS=true uses Tavily's rate-limited keyless access, meant for
 * local testing only.
 */
export function readWebSearchConfig(
  env: WebSearchEnv = process.env as WebSearchEnv
): WebSearchConfig {
  const apiKey = env.TAVILY_API_KEY?.trim();
  if (apiKey) return { ok: true, mode: "key", apiKey };
  if (env.WEB_SEARCH_KEYLESS?.trim().toLowerCase() === "true") {
    return { ok: true, mode: "keyless" };
  }
  return { ok: false };
}

export function isWebRecency(value: unknown): value is WebRecency {
  return typeof value === "string" && (WEB_RECENCY as readonly string[]).includes(value);
}

function clip(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseTavilyResults(payload: unknown): WebSearchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const parsed: WebSearchResult[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!isHttpUrl(record.url)) continue;
    const title = typeof record.title === "string" && record.title.trim()
      ? clip(record.title, 160)
      : new URL(record.url).hostname;
    parsed.push({
      title,
      url: record.url,
      snippet: typeof record.content === "string" ? clip(record.content, SNIPPET_LIMIT) : "",
      publishedDate:
        typeof record.published_date === "string" && record.published_date
          ? record.published_date
          : null,
    });
    if (parsed.length >= MAX_RESULTS) break;
  }
  return parsed;
}

export async function searchWeb(input: {
  query: string;
  recency?: WebRecency | null;
  config: Extract<WebSearchConfig, { ok: true }>;
  fetchImpl?: typeof fetch;
}): Promise<{ query: string; results: WebSearchResult[] }> {
  const query = clip(input.query, QUERY_LIMIT);
  if (!query) throw new Error("Empty search query");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.config.mode === "key") headers.Authorization = `Bearer ${input.config.apiKey}`;
  else headers["X-Tavily-Access-Mode"] = "keyless";

  const response = await (input.fetchImpl ?? fetch)(TAVILY_SEARCH_URL, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: MAX_RESULTS,
      chunks_per_source: 2,
      include_answer: false,
      include_raw_content: false,
      include_published_date: true,
      safe_search: true,
      ...(input.recency ? { time_range: input.recency } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Web search failed (HTTP ${response.status})`);
  }
  return { query, results: parseTavilyResults(await response.json()) };
}
