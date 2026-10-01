import assert from "node:assert/strict";
import test from "node:test";

import { answerBody, checkAnswer, readings, ungroundedNumbers, groundedNumbers } from "./checks.ts";

test("numbers read in Portuguese and English styles", () => {
  assert.equal(readings("1.284").includes(1284), true);
  assert.equal(readings("1,284").includes(1284), true);
  assert.equal(readings("2,5").includes(2.5), true);
  assert.equal(readings("61,2").includes(61.2), true);
});

test("tool numbers, unit conversions, and the question are grounded", () => {
  const allowed = groundedNumbers(
    [{ activeUsers: 1284, engagementRate: 0.612, lcpMs: 3747, snippet: "LCP under 2.5 seconds" }],
    "Como foi nos últimos 45 dias?"
  );
  assert.deepEqual(
    ungroundedNumbers("Foram 1.284 usuários, 61,2% de engajamento, LCP de 3,7 s, meta 2,5 s, nos 45 dias.", allowed),
    []
  );
  assert.deepEqual(ungroundedNumbers("Foram 1.500 usuários.", allowed), ["1.500"]);
});

test("the sources block is not judged as answer text", () => {
  assert.equal(answerBody("Ok.\n\nFontes\n- GA4 · Últimos 7 dias · 2026-10-01T14:00:00Z"), "Ok.");
});

test("a full check reports wrong tools, periods, codes, markdown, and invented numbers", () => {
  const failures = checkAnswer({
    question: "Quantos usuários nos últimos 28 dias?",
    answer: "Nos **28d** foram 9.999 usuários.",
    calls: [{ name: "get_top_pages", args: { period: "7d" } }],
    toolResults: [{ activeUsers: 4879 }],
    expect: { tools: ["get_overview"], period: "28d", forbidTools: ["get_top_pages"] },
  });
  assert.deepEqual(
    failures.map((failure) => failure.check),
    ["tool", "forbidden tool", "period", "period code", "plain text", "grounded numbers"]
  );
});

test("a clean answer passes", () => {
  const failures = checkAnswer({
    question: "Quantos usuários nos últimos 28 dias?",
    answer: "Nos últimos 28 dias, 4.879 usuários ativos (Google Analytics 4).\n\nFontes\n- Google Analytics 4 · Últimos 28 dias · 2026-10-01T14:00:00Z",
    calls: [{ name: "get_overview", args: { period: "28d" } }],
    toolResults: [{ activeUsers: 4879 }],
    expect: { tools: ["get_overview"], period: "28d", says: [/28 dias/] },
  });
  assert.deepEqual(failures, []);
});
