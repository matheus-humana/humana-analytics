import assert from "node:assert/strict";
import test from "node:test";

import { describeFreshness, LIVE_FRESH_MS, SNAPSHOT_FRESH_MS } from "./status.ts";

const ZONE = "America/Sao_Paulo";
/** 2026-09-28 09:00 in São Paulo (UTC-3). */
const NOW = Date.parse("2026-09-28T12:00:00.000Z");

test("a GA4 read from two minutes ago is live and names the age", () => {
  const view = describeFreshness({
    cadence: "live",
    observedAt: new Date(NOW - 2 * 60 * 1000).toISOString(),
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.kind, "live");
  assert.equal(view.tone, "green");
  assert.equal(view.pulse, true);
  assert.equal(view.label, "Ao vivo · atualizado há 2 min");
});

test("a GA4 read inside the fresh window can say just now", () => {
  const view = describeFreshness({
    cadence: "live",
    observedAt: new Date(NOW - 10 * 1000).toISOString(),
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "en",
  });
  assert.equal(view.label, "Live · updated just now");
  assert.equal(view.pulse, true);
});

test("a GA4 read older than the live limit is amber and does not pulse", () => {
  const view = describeFreshness({
    cadence: "live",
    observedAt: new Date(NOW - LIVE_FRESH_MS - 60_000).toISOString(),
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.kind, "stale");
  assert.equal(view.tone, "amber");
  assert.equal(view.pulse, false);
  assert.match(view.label, /^Desatualizado · há /);
});

test("a failed GA4 read keeps the last timestamp and is not shown as live", () => {
  const view = describeFreshness({
    cadence: "live",
    observedAt: new Date(NOW - 2 * 60 * 1000).toISOString(),
    ok: false,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.kind, "stale");
  assert.equal(view.tone, "amber");
  assert.equal(view.pulse, false);
  assert.equal(view.label, "Falha ao atualizar · última leitura há 2 min");
});

test("GA4 with no successful read is gray", () => {
  const missing = describeFreshness({
    cadence: "live",
    observedAt: null,
    ok: false,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(missing.kind, "unavailable");
  assert.equal(missing.tone, "gray");
  assert.equal(missing.pulse, false);
  assert.equal(missing.label, "Sem atualização");

  const invalid = describeFreshness({
    cadence: "live",
    observedAt: "not-a-date",
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "en",
  });
  assert.equal(invalid.label, "No update yet");
});

test("a timestamp far in the future is not treated as live", () => {
  const view = describeFreshness({
    cadence: "live",
    observedAt: new Date(NOW + 10 * 60 * 1000).toISOString(),
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.kind, "unavailable");
  assert.equal(view.pulse, false);
});

test("a daily snapshot from today is not live and shows the clock time", () => {
  const view = describeFreshness({
    cadence: "snapshot",
    observedAt: "2026-09-28T08:15:00.000Z",
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.kind, "snapshot");
  assert.equal(view.tone, "blue");
  assert.equal(view.pulse, false);
  assert.equal(view.label, "Atualizado hoje, 05:15");
});

test("a snapshot from the previous calendar day stays a snapshot inside 36 hours", () => {
  const view = describeFreshness({
    cadence: "snapshot",
    observedAt: "2026-09-27T08:15:00.000Z",
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "en",
  });
  assert.ok(NOW - Date.parse("2026-09-27T08:15:00.000Z") < SNAPSHOT_FRESH_MS);
  assert.equal(view.kind, "snapshot");
  assert.equal(view.pulse, false);
  assert.equal(view.label, "Updated yesterday, 05:15");
});

test("a snapshot older than 36 hours is amber", () => {
  const view = describeFreshness({
    cadence: "snapshot",
    observedAt: "2026-09-26T08:15:00.000Z",
    ok: true,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.ok(NOW - Date.parse("2026-09-26T08:15:00.000Z") > SNAPSHOT_FRESH_MS);
  assert.equal(view.kind, "stale");
  assert.equal(view.tone, "amber");
  assert.equal(view.pulse, false);
  assert.match(view.label, /Desatualizado · última coleta em 26\/09, 05:15/);
});

test("a failed snapshot collect is amber when a previous collect exists", () => {
  const view = describeFreshness({
    cadence: "snapshot",
    observedAt: "2026-09-28T08:15:00.000Z",
    ok: false,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.tone, "amber");
  assert.equal(view.pulse, false);
  assert.equal(view.label, "Desatualizado · última coleta hoje, 05:15");
});

test("a snapshot source with nothing stored is gray", () => {
  const view = describeFreshness({
    cadence: "snapshot",
    observedAt: null,
    ok: false,
    now: NOW,
    timeZone: ZONE,
    locale: "pt-BR",
  });
  assert.equal(view.kind, "unavailable");
  assert.equal(view.tone, "gray");
  assert.equal(view.label, "Sem coleta");
});
