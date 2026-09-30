import assert from "node:assert/strict";
import test from "node:test";

import { percentChange, previousEquivalentRange } from "../analytics/period.ts";

test("previous period is the same length and ends the day before the current window", () => {
  assert.deepEqual(previousEquivalentRange("7d"), {
    startDate: "14daysAgo",
    endDate: "8daysAgo",
  });
  assert.deepEqual(previousEquivalentRange("3d"), {
    startDate: "6daysAgo",
    endDate: "4daysAgo",
  });
  assert.deepEqual(previousEquivalentRange("24h"), {
    startDate: "yesterday",
    endDate: "yesterday",
  });
  assert.deepEqual(previousEquivalentRange("28d"), {
    startDate: "56daysAgo",
    endDate: "29daysAgo",
  });
});

test("percent change is null when the previous value is zero", () => {
  assert.equal(percentChange(10, 0), null);
  assert.equal(percentChange(15, 10), 50);
  assert.equal(percentChange(5, 10), -50);
});
