import assert from "node:assert/strict";
import test from "node:test";

import { groupConversationsByDate } from "./conversation-groups.ts";

test("conversations are grouped by last update, newest first", () => {
  const now = new Date(2026, 9, 1, 10, 0);
  const at = (day: number, hour = 9) => new Date(2026, 9, day, hour).toISOString();
  const groups = groupConversationsByDate(
    [
      { id: "old", updatedAt: new Date(2026, 6, 1).toISOString() },
      { id: "yesterday", updatedAt: new Date(2026, 8, 30, 23).toISOString() },
      { id: "today-early", updatedAt: at(1, 8) },
      { id: "today-late", updatedAt: at(1, 9) },
      { id: "week", updatedAt: new Date(2026, 8, 27).toISOString() },
      { id: "month", updatedAt: new Date(2026, 8, 10).toISOString() },
    ],
    now
  );

  assert.deepEqual(
    groups.map((group) => [group.key, group.items.map((item) => item.id)]),
    [
      ["today", ["today-late", "today-early"]],
      ["yesterday", ["yesterday"]],
      ["week", ["week"]],
      ["month", ["month"]],
      ["older", ["old"]],
    ]
  );
});
