import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WORKSPACE_PREFS,
  parseWorkspacePrefs,
  workspacePrefsKey,
} from "./prefs.ts";

test("missing workspace prefs fall back to every column open", () => {
  const prefs = parseWorkspacePrefs(null);
  assert.deepEqual(prefs.open, DEFAULT_WORKSPACE_PREFS.open);
  assert.equal(prefs.tab, "traffic");
  assert.equal(prefs.layout, null);
  assert.equal(prefs.projectId, null);
});

test("workspace prefs keep open columns, widths, tab, and project", () => {
  const prefs = parseWorkspacePrefs(
    JSON.stringify({
      open: { context: false, analytics: true, actions: false },
      layout: { context: 4, analytics: 40, actions: 4, chat: 52 },
      tab: "seo",
      mobileColumn: "context",
      projectId: "proj_site",
    })
  );

  assert.equal(prefs.open.context, false);
  assert.equal(prefs.open.analytics, true);
  assert.equal(prefs.open.actions, false);
  assert.deepEqual(prefs.layout, {
    context: 4,
    analytics: 40,
    actions: 4,
    chat: 52,
  });
  assert.equal(prefs.tab, "seo");
  assert.equal(prefs.mobileColumn, "context");
  assert.equal(prefs.projectId, "proj_site");
});

test("invalid widths and tabs are discarded", () => {
  const prefs = parseWorkspacePrefs(
    JSON.stringify({
      tab: "links",
      mobileColumn: "chat",
      layout: { context: 10, analytics: Number.NaN, actions: 10, chat: 10 },
      projectId: "  ",
    })
  );

  assert.equal(prefs.tab, "traffic");
  assert.equal(prefs.mobileColumn, "analytics");
  assert.equal(prefs.layout, null);
  assert.equal(prefs.projectId, null);
  assert.equal(prefs.open.context, true);
});

test("prefs are stored per user", () => {
  assert.equal(workspacePrefsKey("user_a"), "ha-workspace:user_a");
  assert.notEqual(workspacePrefsKey("user_a"), workspacePrefsKey("user_b"));
});
