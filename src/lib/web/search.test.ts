import assert from "node:assert/strict";
import test from "node:test";

import { parseTavilyResults, readWebSearchConfig, searchWeb } from "./search.ts";

test("an API key wins over keyless mode, and nothing set means off", () => {
  assert.deepEqual(readWebSearchConfig({ TAVILY_API_KEY: " tvly-1 ", WEB_SEARCH_KEYLESS: "true" }), {
    ok: true,
    mode: "key",
    apiKey: "tvly-1",
  });
  assert.deepEqual(readWebSearchConfig({ WEB_SEARCH_KEYLESS: "TRUE" }), { ok: true, mode: "keyless" });
  assert.deepEqual(readWebSearchConfig({ WEB_SEARCH_KEYLESS: "1" }), { ok: false });
  assert.deepEqual(readWebSearchConfig({}), { ok: false });
});

test("results keep http(s) pages only, at most five, with clipped snippets", () => {
  const results = parseTavilyResults({
    results: [
      { title: "Web Vitals", url: "https://web.dev/vitals/", content: "a".repeat(700), published_date: "2026-09-01" },
      { title: "Bad", url: "javascript:alert(1)", content: "x" },
      { url: "https://example.com/no-title", content: "  spaced\n text  " },
      ...Array.from({ length: 6 }, (_, index) => ({ title: `R${index}`, url: `https://r${index}.com`, content: "" })),
    ],
  });

  assert.equal(results.length, 5);
  assert.equal(results[0]?.snippet.length, 601);
  assert.equal(results[0]?.publishedDate, "2026-09-01");
  assert.equal(results[1]?.title, "example.com");
  assert.equal(results[1]?.snippet, "spaced text");
  assert.equal(results.some((result) => result.url.startsWith("javascript")), false);
});

test("the key goes in the Authorization header and errors never echo it", async () => {
  let headers: Record<string, string> = {};
  let body: Record<string, unknown> = {};
  const ok = (async (_url: string, init: RequestInit) => {
    headers = init.headers as Record<string, string>;
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  }) as typeof fetch;

  await searchWeb({ query: "core web vitals", recency: "month", config: { ok: true, mode: "key", apiKey: "tvly-secret" }, fetchImpl: ok });
  assert.equal(headers.Authorization, "Bearer tvly-secret");
  assert.equal(body.search_depth, "basic");
  assert.equal(body.time_range, "month");

  await searchWeb({ query: "q", config: { ok: true, mode: "keyless" }, fetchImpl: ok });
  assert.equal(headers["X-Tavily-Access-Mode"], "keyless");
  assert.equal("Authorization" in headers, false);
  assert.equal("time_range" in body, false);

  const failing = (async () => new Response("no", { status: 432 })) as typeof fetch;
  await assert.rejects(
    searchWeb({ query: "q", config: { ok: true, mode: "key", apiKey: "tvly-secret" }, fetchImpl: failing }),
    (error: Error) => error.message.includes("432") && !error.message.includes("tvly-secret")
  );
});
