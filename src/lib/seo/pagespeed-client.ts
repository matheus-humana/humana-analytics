import { PAGESPEED_TIMEOUT_MS } from "./config";
import { parsePagespeedResponse } from "./pagespeed-parse";
import type { PagespeedStrategy, ParsedPagespeed } from "./types";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type PagespeedFetch = (url: string, init: RequestInit) => Promise<Response>;

export async function fetchPagespeed(input: {
  pageUrl: string;
  strategy: PagespeedStrategy;
  apiKey: string | null;
  fetchImpl?: PagespeedFetch;
  timeoutMs?: number;
}): Promise<{ ok: true; data: ParsedPagespeed } | { ok: false; error: string; quota: boolean }> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("url", input.pageUrl);
  url.searchParams.set("strategy", input.strategy);
  for (const category of ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"]) {
    url.searchParams.append("category", category);
  }
  if (input.apiKey) url.searchParams.set("key", input.apiKey);

  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? PAGESPEED_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    const parsed = parsePagespeedResponse(body);
    if (!response.ok || !parsed.ok) {
      const error = !parsed.ok
        ? parsed.error
        : `PageSpeed HTTP ${response.status}`;
      return { ok: false, error: error.slice(0, 400), quota: response.status === 429 || /quota/i.test(error) };
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "PageSpeed timed out." : error instanceof Error ? error.message : "PageSpeed request failed",
      quota: false,
    };
  } finally {
    clearTimeout(timer);
  }
}
