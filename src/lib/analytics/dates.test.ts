import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGa4Date, previousRange, resolveDateRange } from "./dates";

describe("parseGa4Date", () => {
  it("converts YYYYMMDD to ISO", () => {
    assert.equal(parseGa4Date("20260920"), "2026-09-20");
  });

  it("keeps ISO dates", () => {
    assert.equal(parseGa4Date("2026-09-20"), "2026-09-20");
  });
});

describe("resolveDateRange", () => {
  it("defaults to the last 7 complete UTC days", () => {
    const range = resolveDateRange({
      now: new Date("2026-09-21T15:00:00.000Z"),
    });
    assert.deepEqual(range, {
      startDate: "2026-09-14",
      endDate: "2026-09-20",
    });
  });

  it("uses explicit dates", () => {
    const range = resolveDateRange({
      startDate: "2026-09-01",
      endDate: "2026-09-07",
    });
    assert.deepEqual(range, {
      startDate: "2026-09-01",
      endDate: "2026-09-07",
    });
  });
});

describe("previousRange", () => {
  it("returns the immediately preceding equal-length period", () => {
    assert.deepEqual(
      previousRange({ startDate: "2026-09-14", endDate: "2026-09-20" }),
      { startDate: "2026-09-07", endDate: "2026-09-13" },
    );
  });
});
