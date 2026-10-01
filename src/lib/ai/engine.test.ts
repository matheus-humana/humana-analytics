import assert from "node:assert/strict";
import test from "node:test";

import { APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";

import {
  preferProvider,
  resolveChatEngine,
  selectReplyEngine,
} from "./analytics-bot-contract.ts";
import { chatModelOptions } from "./engine.ts";
import { modelDisplayName } from "./model-label.ts";
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

test("the model picked in the chat goes first and the default becomes the fallback", () => {
  const env = {
    chatEngine: "native",
    geminiKey: "gem-test",
    groqKey: "gsk-test",
    primary: "gemini",
    fallback: "groq",
  };
  const engine = resolveChatEngine(env);

  assert.deepEqual(preferProvider(engine, "groq", env), {
    engine: "native",
    primary: "groq",
    fallback: "gemini",
  });
  assert.deepEqual(preferProvider(engine, "gemini", env), engine);
  assert.deepEqual(preferProvider(engine, "openai", env), engine);
  assert.deepEqual(preferProvider(engine, "anything", env), engine);
  assert.deepEqual(preferProvider(engine, undefined, env), engine);

  const bridgeEnv = { chatEngine: "bridge", webhookUrl: "https://bot.example/hook", groqKey: "gsk" };
  const bridge = resolveChatEngine(bridgeEnv);
  assert.deepEqual(preferProvider(bridge, "groq", bridgeEnv), bridge);
});

test("chat model options list Gemini and Groq with their role and key state", () => {
  const options = chatModelOptions({
    chatEngine: "native",
    geminiKey: "gem-test",
    primary: "gemini",
  });
  assert.equal(options.selectable, true);
  assert.deepEqual(
    options.models.map(({ provider, configured, role }) => ({ provider, configured, role })),
    [
      { provider: "gemini", configured: true, role: "primary" },
      { provider: "groq", configured: false, role: null },
    ]
  );
  assert.equal(chatModelOptions({ chatEngine: "bridge", webhookUrl: "https://x" }).selectable, false);
});

test("model ids become readable names", () => {
  assert.equal(modelDisplayName("gemini-3.5-flash-lite"), "Gemini 3.5 Flash Lite");
  assert.equal(modelDisplayName("openai/gpt-oss-120b"), "GPT OSS 120B");
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
