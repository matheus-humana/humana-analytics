import assert from "node:assert/strict";
import test from "node:test";

import { APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";

import { resolveChatEngine, selectReplyEngine } from "./analytics-bot-contract.ts";
import { shouldFallback } from "./providers.ts";
import { summarizeUsage, emptyUsage } from "./usage.ts";

test("unset CHAT_ENGINE keeps webhook ahead of OpenAI", () => {
  assert.equal(
    selectReplyEngine({
      webhookUrl: " https://bot.example/hook ",
      openAiKey: "sk-test",
      geminiKey: "gem-test",
    }),
    "webhook"
  );
  assert.equal(
    selectReplyEngine({ webhookUrl: " ", openAiKey: "sk-test" }),
    "openai"
  );
  assert.equal(selectReplyEngine({ webhookUrl: "", openAiKey: "" }), "none");
});

test("CHAT_ENGINE selects the native Gemini engine and Groq fallback", () => {
  const native = resolveChatEngine({
    chatEngine: "native",
    webhookUrl: "https://bot.example/hook",
    geminiKey: "gem-test",
    groqKey: "gsk-test",
    openAiKey: "sk-test",
    primary: "gemini",
    fallback: "groq",
  });
  assert.equal(native.engine, "native");
  assert.equal(native.primary, "gemini");
  assert.equal(native.fallback, "groq");

  const bridge = resolveChatEngine({
    chatEngine: "bridge",
    webhookUrl: "https://bot.example/hook",
    geminiKey: "gem-test",
  });
  assert.equal(bridge.engine, "webhook");

  const missing = resolveChatEngine({ chatEngine: "native" });
  assert.equal(missing.engine, "none");
});

test("fallback runs for rate limit, server errors, and timeouts", () => {
  assert.equal(shouldFallback(new APIError(429, undefined, "slow", undefined)), true);
  assert.equal(shouldFallback(new APIError(503, undefined, "down", undefined)), true);
  assert.equal(shouldFallback(new APIError(400, undefined, "bad", undefined)), false);
  assert.equal(shouldFallback(new APIConnectionTimeoutError()), true);
  assert.equal(shouldFallback(new APIUserAbortError()), false);
});

test("Gemini and Groq usage costs zero", () => {
  const usage = emptyUsage();
  usage.promptTokens = 1000;
  usage.completionTokens = 1000;
  usage.totalTokens = 2000;
  assert.equal(summarizeUsage("gemini-3.5-flash-lite", usage, "gemini").estimatedCostUsd, 0);
  assert.equal(summarizeUsage("openai/gpt-oss-120b", usage, "groq").estimatedCostUsd, 0);
  assert.equal(summarizeUsage("gpt-4o-mini", usage, "openai").estimatedCostUsd > 0, true);
});
