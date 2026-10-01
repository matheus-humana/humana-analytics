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
  assert.equal(prefs.mode, "project");
  assert.equal(prefs.layout, null);
  assert.equal(prefs.projectId, null);
  assert.equal(prefs.repositoryId, null);
});

test("workspace prefs keep open columns, widths, tab, mode, and selections", () => {
  const prefs = parseWorkspacePrefs(
    JSON.stringify({
      open: { analytics: false },
      layout: { analytics: 44, chat: 56 },
      tab: "seo",
      mode: "repository",
      projectId: "proj_site",
      repositoryId: "proj_repo",
    })
  );

  assert.equal(prefs.open.analytics, false);
  assert.deepEqual(prefs.layout, { analytics: 44, chat: 56 });
  assert.equal(prefs.tab, "seo");
  assert.equal(prefs.mode, "repository");
  assert.equal(prefs.projectId, "proj_site");
  assert.equal(prefs.repositoryId, "proj_repo");
});

test("invalid widths and tabs are discarded", () => {
  const prefs = parseWorkspacePrefs(
    JSON.stringify({
      tab: "links",
      mode: "other",
      layout: { analytics: Number.NaN, chat: 10 },
      projectId: "  ",
    })
  );

  assert.equal(prefs.tab, "traffic");
  assert.equal(prefs.mode, "project");
  assert.equal(prefs.layout, null);
  assert.equal(prefs.projectId, null);
  assert.equal(prefs.open.analytics, true);
});

test("prefs saved with removed columns drop the layout and the GitHub tab", () => {
  const prefs = parseWorkspacePrefs(
    JSON.stringify({
      open: { context: false, analytics: true, actions: false },
      layout: { context: 20, analytics: 30, actions: 20, chat: 30 },
      tab: "github",
      mobileColumn: "context",
    })
  );

  assert.equal(prefs.layout, null);
  assert.equal(prefs.tab, "traffic");
  assert.deepEqual(Object.keys(prefs.open), ["analytics"]);
  assert.equal("mobileColumn" in prefs, false);
});

test("prefs are stored per user", () => {
  assert.equal(workspacePrefsKey("user_a"), "ha-workspace:user_a");
  assert.notEqual(workspacePrefsKey("user_a"), workspacePrefsKey("user_b"));
});
