import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStatusLog,
  describeConnection,
  type ChatSignal,
  type ConnectionSnapshot,
} from "./status-log.ts";

const ga4: ConnectionSnapshot = {
  provider: "ga4",
  connected: true,
  status: "active",
  updatedAt: null,
};

test("a connection without a timestamp does not invent a clock time", () => {
  const text = describeConnection(ga4, "pt-BR");
  assert.equal(text, "GA4 · conectado");
  assert.equal(/\d{1,2}:\d{2}/.test(text), false);
});

test("an invalid timestamp is omitted", () => {
  const text = describeConnection(
    { ...ga4, updatedAt: "not-a-date" },
    "en"
  );
  assert.equal(text, "GA4 · connected");
});

test("the status line uses the newest real event", () => {
  const chats: ChatSignal[] = [
    { id: "q1", kind: "question", at: "2026-09-25T12:00:00.000Z" },
    { id: "r1", kind: "reply", at: "2026-09-25T12:05:00.000Z" },
  ];
  const log = buildStatusLog(
    [{ ...ga4, updatedAt: "2026-09-25T10:00:00.000Z" }],
    chats,
    "pt-BR"
  );
  assert.match(log.line ?? "", /Resposta recebida/);
  assert.equal(log.items[0]?.id, "chat:r1");
});

test("connection status is the line when nothing else happened", () => {
  const log = buildStatusLog(
    [
      ga4,
      { provider: "clarity", connected: false, status: "not_connected", updatedAt: null },
    ],
    [],
    "en"
  );
  assert.equal(log.line, "GA4 · connected · Clarity · disconnected");
  assert.equal(log.items.length, 2);
});

test("a GitHub permission error is shown as returned, without a stand-in number", () => {
  const log = buildStatusLog(
    [
      {
        provider: "github",
        connected: false,
        status: "error",
        updatedAt: null,
        detail: "acme/widget: GitHub 403: Must have push access to repository",
      },
    ],
    [],
    "pt-BR"
  );
  assert.equal(
    log.line,
    "GitHub · erro · acme/widget: GitHub 403: Must have push access to repository"
  );
});

test("no connections and no chat events stay empty", () => {
  const log = buildStatusLog([], [], "pt-BR");
  assert.equal(log.line, null);
  assert.deepEqual(log.items, []);
});
