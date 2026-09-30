import assert from "node:assert/strict";
import test from "node:test";

import { APIError } from "openai";

import { runAskAiAgent } from "./agent.ts";
import { toolCallIndex, type ToolCallDelta } from "./providers.ts";
import { emptyUsage } from "./usage.ts";

const sources = { ga4: true, github: false, seo: false, geo: false };

test("the agent replaces a numeric answer when it never called a tool", async () => {
  const result = await runAskAiAgent({
    question: "Quantos usuários?",
    locale: "pt-BR",
    projectId: "proj_1",
    sources,
    selection: { engine: "native", primary: "gemini", fallback: null },
    keys: { gemini: "test-key" },
    complete: async () => ({
      content: "Foram 1500 usuários.",
      toolCalls: [],
      usage: emptyUsage(),
    }),
    executeTool: async () => {
      throw new Error("tool should not run");
    },
  });

  assert.equal(result.answer.includes("1500"), false);
  assert.match(result.answer, /Não consegui buscar os dados/);
  assert.equal(result.usedFallback, false);
});

test("a tool result becomes the sources block and a 429 falls back to Groq", async () => {
  const seen: string[] = [];
  const result = await runAskAiAgent({
    question: "How many active users?",
    locale: "en",
    projectId: "proj_1",
    sources,
    selection: { engine: "native", primary: "gemini", fallback: "groq" },
    keys: { gemini: "gem-key", groq: "groq-key" },
    complete: async (input) => {
      seen.push(input.provider);
      if (input.provider === "gemini") {
        throw new APIError(429, undefined, "rate limit", undefined);
      }
      const answered = input.messages.some((message) => message.role === "tool");
      if (!answered) {
        return {
          content: "",
          toolCalls: [{ id: "call_1", name: "get_overview", arguments: "{\"period\":\"7d\"}" }],
          usage: emptyUsage(),
        };
      }
      return {
        content: "Active users are in the tool result for this period.",
        toolCalls: [],
        usage: emptyUsage(),
      };
    },
    executeTool: async () => ({
      source: "Google Analytics 4",
      connected: true,
      periodId: "7d",
      activeUsers: 10,
    }),
  });

  assert.deepEqual(seen, ["gemini", "groq", "groq"]);
  assert.equal(result.provider, "groq");
  assert.equal(result.usedFallback, true);
  assert.equal(result.usage.estimatedCostUsd, 0);
  assert.equal(result.toolsUsed[0]?.name, "get_overview");
  assert.equal(result.toolsUsed[0]?.ok, true);
  assert.equal(result.toolsUsed[0]?.args.period, "7d");
  assert.equal("activeUsers" in (result.toolsUsed[0] ?? {}), false);
  assert.match(result.answer, /Sources/);
  assert.match(result.answer, /Google Analytics 4/);
  assert.match(result.answer, /Last 7 days/);
});

test("the Gemini thought signature goes back with the tool call on the next round", async () => {
  const signature = { google: { thought_signature: "sig-abc" } };
  let echoed: unknown;
  await runAskAiAgent({
    question: "How many active users?",
    locale: "en",
    projectId: "proj_1",
    sources,
    selection: { engine: "native", primary: "gemini", fallback: null },
    keys: { gemini: "gem-key" },
    complete: async (input) => {
      const assistant = input.messages.find(
        (message) => message.role === "assistant" && "tool_calls" in message
      );
      if (!assistant) {
        return {
          content: "",
          toolCalls: [
            { id: "call_1", name: "get_overview", arguments: "{}", extraContent: signature },
          ],
          usage: emptyUsage(),
        };
      }
      const calls = (assistant as { tool_calls?: Array<Record<string, unknown>> }).tool_calls;
      echoed = calls?.[0]?.extra_content;
      return { content: "Done.", toolCalls: [], usage: emptyUsage() };
    },
    executeTool: async () => ({ source: "Google Analytics 4", connected: true, periodId: "7d" }),
  });

  assert.deepEqual(echoed, signature);
});

test("tool calls without an index stay separate when the id changes", () => {
  const acc = new Map<number, ToolCallDelta>();
  const first = toolCallIndex(acc, { id: "call_1", function: { name: "get_overview" } });
  acc.set(first, { id: "call_1", name: "get_overview", arguments: "{}" });
  const second = toolCallIndex(acc, { id: "call_2", function: { name: "get_top_pages" } });
  const fragment = toolCallIndex(acc, { index: 0, function: { arguments: "{}" } });

  assert.equal(first, 0);
  assert.equal(second, 1);
  assert.equal(fragment, 0);
});
