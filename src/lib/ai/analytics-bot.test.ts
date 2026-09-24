import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOutboundPayload,
  postAnalyticsBotWebhook,
  secretsMatch,
} from "./analytics-bot.ts";
import {
  assertReplyOwnership,
  buildOutboundHeaders,
  composeAssistantContent,
  inferChatLocale,
  MISSING_ENGINE_MESSAGE,
  parseReplyBody,
  readReplySecret,
  replyWritePlan,
  selectReplyEngine,
  splitAssistantContent,
  thinkingLabel,
  WEBHOOK_REJECTED_MESSAGE,
  WEBHOOK_TIMEOUT_MESSAGE,
} from "./analytics-bot-contract.ts";

const payloadInput = {
  conversationId: "conv_1",
  messageId: "msg_1",
  userId: "user_1",
  organizationId: "org_humana",
  projectId: "proj_1",
  text: "Quantos usuários? Fale com user@humana.ai",
  replyUrl: "https://analytics.example/api/analytics-bot/reply",
  createdAt: "2026-09-24T12:00:00.000Z",
};

test("webhook path wins over OpenAI and a missing engine does not invent metrics", () => {
  assert.equal(
    selectReplyEngine({
      webhookUrl: " https://bot.example/hook ",
      openAiKey: "sk-test",
    }),
    "webhook"
  );
  assert.equal(
    selectReplyEngine({ webhookUrl: " ", openAiKey: "sk-test" }),
    "openai"
  );
  assert.equal(selectReplyEngine({ webhookUrl: "", openAiKey: "" }), "none");
  assert.equal(/\d/.test(MISSING_ENGINE_MESSAGE), false);
  assert.match(MISSING_ENGINE_MESSAGE, /Nenhuma métrica/);
});

test("outbound payload matches the bridge contract and redacts contact data", () => {
  const payload = buildOutboundPayload({
    ...payloadInput,
    text: `${"a".repeat(500)} user@humana.ai Bearer ya29.secret`,
  });

  assert.deepEqual(Object.keys(payload).sort(), [
    "conversationId",
    "createdAt",
    "locale",
    "messageId",
    "organizationId",
    "projectId",
    "replyUrl",
    "text",
    "userId",
  ]);
  assert.equal(payload.locale, "pt-BR");
  assert.equal(payload.text.includes("user@humana.ai"), false);
  assert.equal(payload.text.includes("ya29.secret"), false);
  assert.equal(payload.text.length > 400, true);
  assert.equal(inferChatLocale("Where did our visitors come from?"), "en");
  assert.equal(thinkingLabel("en"), "Thinking…");
  assert.equal(thinkingLabel("pt-BR"), "Pensando…");
});

test("webhook request sends the sender key and does not echo it on failure", async () => {
  const payload = buildOutboundPayload(payloadInput);
  let authorization = "";
  const sent = await postAnalyticsBotWebhook(payload, {
    webhookUrl: "https://bot.example/hook?token=query-secret",
    webhookSecret: "sender-key",
    fetchImpl: async (_url, init) => {
      authorization = new Headers(init.headers).get("authorization") ?? "";
      assert.equal(init.redirect, "error");
      assert.equal(
        new Headers(init.headers).get("x-analytics-bot-key"),
        "sender-key"
      );
      return new Response("nope", { status: 500 });
    },
  });

  assert.equal(authorization, "Bearer sender-key");
  assert.equal(sent.ok, false);
  if (!sent.ok) {
    assert.equal(sent.error, WEBHOOK_REJECTED_MESSAGE);
    assert.equal(sent.error.includes("sender-key"), false);
    assert.equal(sent.error.includes("query-secret"), false);
  }
});

test("webhook timeout stays grounded", async () => {
  const payload = buildOutboundPayload(payloadInput);
  const sent = await postAnalyticsBotWebhook(payload, {
    webhookUrl: "https://bot.example/hook",
    webhookSecret: null,
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });

  assert.equal(sent.ok, false);
  if (!sent.ok) assert.equal(sent.error, WEBHOOK_TIMEOUT_MESSAGE);
  assert.equal("Authorization" in buildOutboundHeaders(null), false);
});

test("reply secret must match and conflicting headers are rejected", () => {
  assert.equal(secretsMatch("reply-secret", "reply-secret"), true);
  assert.equal(secretsMatch("reply-secret", "other"), false);
  assert.equal(secretsMatch("", ""), false);

  const headers = (map: Record<string, string>) => ({
    get(name: string) {
      return map[name.toLowerCase()] ?? null;
    },
  });

  assert.equal(
    readReplySecret(headers({ authorization: "Bearer reply-secret" })),
    "reply-secret"
  );
  assert.equal(
    readReplySecret(headers({ "x-analytics-bot-reply-secret": "reply-secret" })),
    "reply-secret"
  );
  assert.equal(
    readReplySecret(
      headers({
        authorization: "Bearer reply-secret",
        "x-analytics-bot-reply-secret": "other",
      })
    ),
    null
  );
});

test("reply body keeps the contract and drops unsafe attachment urls", () => {
  const parsed = parseReplyBody({
    conversationId: "conv_1",
    messageId: "msg_1",
    text: "O Clarity não devolveu sessões nesse período.",
    source: "analytics-bot",
    userId: "user_1",
    organizationId: "org_humana",
    projectId: "proj_1",
    imageUrls: [
      "https://cdn.example/chart.png",
      "http://cdn.example/chart.png",
      "javascript:alert(1)",
    ],
    attachments: [{ url: "https://cdn.example/extra.webp" }],
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.reply.imageUrls, [
    "https://cdn.example/chart.png",
    "https://cdn.example/extra.webp",
  ]);
  assert.equal(parseReplyBody({ text: "hi" }).ok, false);
  assert.equal(parseReplyBody({ conversationId: "conv_1", text: "  " }).ok, false);

  const owned = assertReplyOwnership({
    conversationUserId: "user_1",
    conversationProjectId: "proj_1",
    conversationOrganizationId: "org_humana",
    userId: "other",
    projectId: null,
    organizationId: null,
  });
  assert.equal(owned.ok, false);
});

test("pending placeholder is replaced once and image lines render separately", () => {
  assert.equal(replyWritePlan(null), "insert");
  assert.equal(replyWritePlan("Pensando…"), "replace");
  assert.equal(replyWritePlan("Thinking…"), "replace");
  assert.equal(replyWritePlan("Resposta real"), "duplicate");

  const content = composeAssistantContent("Resposta", [
    "https://cdn.example/chart.png",
  ]);
  const parts = splitAssistantContent(content);
  assert.equal(parts.text, "Resposta");
  assert.deepEqual(parts.images, ["https://cdn.example/chart.png"]);
});
