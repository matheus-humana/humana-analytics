import assert from "node:assert/strict";
import test from "node:test";

import {
  MISSING_ENGINE_MESSAGE,
  WEBHOOK_REJECTED_MESSAGE,
  WEBHOOK_TIMEOUT_MESSAGE,
  WEBHOOK_UNREACHABLE_MESSAGE,
} from "../ai/analytics-bot-contract.ts";
import { formatCount, formatRatePercent, formatWeekdayShort } from "./format.ts";
import { localizeKnownCopy } from "./known-copy.ts";
import { periodLabel } from "./period-label.ts";
import { workspaceCopy } from "./workspace-copy.ts";

test("counts and percents follow the active locale", () => {
  assert.equal(formatCount(1234, "pt-BR"), "1.234");
  assert.equal(formatCount(1234, "en"), "1,234");
  assert.equal(formatRatePercent(0.1234, "pt-BR"), "12,34%");
  assert.equal(formatRatePercent(0.1234, "en"), "12.34%");
});

test("weekday labels follow the active locale and keep the calendar day", () => {
  assert.equal(formatWeekdayShort("2026-09-28", "en"), "Mon");
  assert.match(formatWeekdayShort("20260928", "pt-BR"), /^seg/i);
});

test("period labels are translated without changing the period id", () => {
  assert.equal(periodLabel("pt-BR", "7d"), "Últimos 7 dias");
  assert.equal(periodLabel("en", "7d"), "Last 7 days");
  assert.equal(periodLabel("en", "3d"), "Last 3 days");
});

test("stored Portuguese errors and dictionary keys resolve in English", () => {
  assert.equal(workspaceCopy["pt-BR"].engineMissing, MISSING_ENGINE_MESSAGE);
  assert.equal(workspaceCopy["pt-BR"].webhookRejected, WEBHOOK_REJECTED_MESSAGE);
  assert.equal(workspaceCopy["pt-BR"].webhookUnreachable, WEBHOOK_UNREACHABLE_MESSAGE);
  assert.equal(workspaceCopy["pt-BR"].webhookTimeout, WEBHOOK_TIMEOUT_MESSAGE);
  assert.equal(localizeKnownCopy("Falha ao carregar GA4", "en"), "GA4 failed to load");
  assert.equal(localizeKnownCopy("ga4ActiveUsers", "en"), "Active users");
  assert.equal(localizeKnownCopy("/pricing", "en"), "/pricing");
});
