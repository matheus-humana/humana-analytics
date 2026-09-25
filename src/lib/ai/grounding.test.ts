import assert from "node:assert/strict";
import test from "node:test";

import { buildHumanaAnalyticsPrompt } from "./prompts.ts";
import { redactSensitive } from "./redact.ts";
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

test("system prompt requires grounded bilingual answers", () => {
  const prompt = buildHumanaAnalyticsPrompt({
    periodLabel: "Últimos 7 dias",
    sources: { ga4: true, clarity: false, vercel: true, github: false },
  });
  assert.match(prompt, /Humana Analytics/);
  assert.match(prompt, /Never invent/);
  assert.match(prompt, /Brazilian Portuguese/);
  assert.match(prompt, /English/);
  assert.match(prompt, /Últimos 7 dias/);
  assert.match(prompt, /Google Analytics 4/);
  assert.match(prompt, /Vercel Analytics/);
  assert.match(prompt, /No analytics source is connected|Connected sources/);
  assert.match(prompt, /Microsoft Clarity/);
});
