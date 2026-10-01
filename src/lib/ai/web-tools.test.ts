import assert from "node:assert/strict";
import test from "node:test";

import { executeWebTool } from "./tools/web-tools.ts";

test("web search reports itself as off when no key or keyless flag is set", async () => {
  const result = (await executeWebTool("{\"query\":\"x\"}", { config: { ok: false } })) as Record<string, unknown>;
  assert.equal(result.connected, false);
  assert.equal(result.source, "Web search");
});

test("contact data is stripped from the query before it leaves the server", async () => {
  let sent = "";
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    sent = String(JSON.parse(String(init.body)).query);
    return new Response(
      JSON.stringify({ results: [{ title: "T", url: "https://t.com", content: "c" }] }),
      { status: 200 }
    );
  }) as typeof fetch;

  const result = (await executeWebTool(
    "{\"query\":\"ana@humana.ai pricing benchmarks\",\"recency\":\"forever\"}",
    { config: { ok: true, mode: "keyless" }, fetchImpl }
  )) as Record<string, unknown>;

  assert.equal(sent.includes("@"), false);
  assert.match(sent, /pricing benchmarks/);
  assert.equal(result.web, true);
  assert.equal((result.results as unknown[]).length, 1);
});

test("a failed search is reported as a failed query", async () => {
  const fetchImpl = (async () => new Response("", { status: 500 })) as typeof fetch;
  const result = (await executeWebTool("{\"query\":\"q\"}", {
    config: { ok: true, mode: "keyless" },
    fetchImpl,
  })) as Record<string, unknown>;
  assert.equal(result.connected, true);
  assert.match(String(result.error), /HTTP 500/);
});
