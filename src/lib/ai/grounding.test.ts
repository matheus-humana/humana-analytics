import assert from "node:assert/strict";
import test from "node:test";

import { finalizeAnswer, containsMetric, stripModelSources } from "./grounding.ts";
import { buildHumanaAnalyticsPrompt } from "./prompts.ts";
import { redactSensitive } from "./redact.ts";
import { attachCitation, prepareToolResult } from "./tool-trace.ts";
import { notConnected } from "./tools/tool-messages.ts";

test("redactSensitive removes tokens, emails, and GA4 property paths", () => {
  const raw =
    "Bearer ya29.secret token user@humana.ai properties/1234567890";
  const redacted = redactSensitive(raw);
  assert.equal(redacted.includes("ya29"), false);
  assert.equal(redacted.includes("user@humana.ai"), false);
  assert.equal(redacted.includes("1234567890"), false);
  assert.match(redacted, /\[redacted\]/);
});

test("disconnected tool payload does not include metrics", () => {
  const payload = notConnected("Microsoft Clarity");
  assert.equal(payload.connected, false);
  assert.match(payload.instruction, /Data Sources/);
  assert.equal("sessions" in payload, false);
  assert.equal("visitors" in payload, false);
});

test("system prompt requires grounded bilingual answers and does not offer Clarity or Vercel", () => {
  const prompt = buildHumanaAnalyticsPrompt({
    periodLabel: "Últimos 7 dias",
    sources: { ga4: true, github: true, seo: true, geo: false },
  });
  assert.match(prompt, /Humana Analytics/);
  assert.match(prompt, /Never invent/);
  assert.match(prompt, /Brazilian Portuguese/);
  assert.match(prompt, /English/);
  assert.match(prompt, /Últimos 7 dias/);
  assert.match(prompt, /Google Analytics 4/);
  assert.match(prompt, /GitHub/);
  assert.match(prompt, /PageSpeed Insights/);
  assert.match(prompt, /Connected sources/);
  assert.doesNotMatch(prompt, /Connected sources:.*Vercel Analytics/);
  assert.doesNotMatch(prompt, /Connected sources:.*Microsoft Clarity/);
  assert.match(prompt, /Do not use Microsoft Clarity or Vercel Analytics/);
  assert.match(prompt, /Do not write a Sources or Fontes section/);
  assert.match(prompt, /get_project_context is qualitative/);
});

test("the server writes the sources block and drops a model-written one", () => {
  const answer = finalizeAnswer({
    draft: "O tráfego veio da busca.\n\nFontes\n- inventado",
    locale: "pt-BR",
    calls: [
      {
        name: "get_traffic_sources",
        args: { period: "7d" },
        source: "Google Analytics 4",
        period: "7d",
        ok: true,
        durationMs: 12,
      },
    ],
    citations: [
      {
        source: "Google Analytics 4",
        period: "7d",
        retrievedAt: "2026-09-29T12:00:00.000Z",
      },
    ],
    disconnectedSources: [],
  });
  assert.equal(answer.includes("inventado"), false);
  assert.match(answer, /Fontes/);
  assert.match(answer, /Google Analytics 4/);
  assert.match(answer, /Últimos 7 dias/);
  assert.match(answer, /2026-09-29T12:00:00.000Z/);
  assert.equal(stripModelSources("ok\n\nSources\n- fake"), "ok");
});

test("metrics without a quantitative tool are replaced", () => {
  assert.equal(containsMetric("cerca de 1200 usuários"), true);
  assert.equal(containsMetric("nos últimos 7 dias"), false);
  const answer = finalizeAnswer({
    draft: "Tivemos 1200 usuários.",
    locale: "pt-BR",
    calls: [],
    citations: [],
    disconnectedSources: [],
  });
  assert.equal(answer.includes("1200"), false);
  assert.match(answer, /Não consegui buscar os dados/);

  const english = finalizeAnswer({
    draft: "We had 50 sessions.",
    locale: "en",
    calls: [
      {
        name: "get_project_context",
        args: {},
        source: "Project context",
        period: null,
        ok: true,
        durationMs: 4,
      },
    ],
    citations: [],
    disconnectedSources: [],
  });
  assert.equal(english.includes("50"), false);
  assert.match(english, /couldn't fetch the data/i);
});

test("a disconnected source is explicit and carries a citation without metrics", () => {
  const payload = prepareToolResult(notConnected("Google Analytics 4"), "2026-09-29T12:00:00.000Z");
  const record = payload as {
    connected: boolean;
    sessions?: number;
    citation: { source: string; period: string | null; retrievedAt: string };
  };
  assert.equal(record.connected, false);
  assert.equal(record.sessions, undefined);
  assert.equal(record.citation.source, "Google Analytics 4");
  assert.equal(record.citation.period, "not-connected");
  assert.equal(record.citation.retrievedAt, "2026-09-29T12:00:00.000Z");

  const answer = finalizeAnswer({
    draft: "Provavelmente uns 80 usuários.",
    locale: "pt-BR",
    calls: [
      {
        name: "get_overview",
        args: { period: "7d" },
        source: "Google Analytics 4",
        period: "not-connected",
        ok: false,
        durationMs: 8,
      },
    ],
    citations: [record.citation],
    disconnectedSources: ["Google Analytics 4"],
  });
  assert.equal(answer.includes("80"), false);
  assert.match(answer, /Google Analytics 4 não está conectado/);
  assert.match(answer, /Fontes/);
});

test("tool results stay compact and keep the citation", () => {
  const prepared = prepareToolResult(
    {
      source: "Google Analytics 4",
      connected: true,
      periodId: "7d",
      pages: Array.from({ length: 20 }, (_, index) => ({ name: `/p${index}`, value: index })),
    },
    "2026-09-29T12:00:00.000Z"
  ) as { pages: unknown[]; citation: { source: string } };
  assert.equal(prepared.pages.length, 8);
  assert.equal(prepared.citation.source, "Google Analytics 4");
  assert.equal(
    (attachCitation({ source: "GitHub", periodId: "7d" }, "2026-09-29T00:00:00.000Z") as {
      citation: { period: string };
    }).citation.period,
    "7d"
  );
});
