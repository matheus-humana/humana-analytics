import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import type { Ga4FixtureFile } from "./adapter";
import {
  mapDailyReport,
  mapEventsReport,
  mapPagesReport,
  mapTrafficReport,
} from "./map-report";

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/ga4-sample.json"), "utf8"),
) as Ga4FixtureFile;

describe("mapDailyReport", () => {
  it("maps GA4 daily rows into persisted metric records", () => {
    const rows = mapDailyReport(fixture.daily ?? {});
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], {
      date: "2026-09-20",
      activeUsers: 51,
      sessions: 63,
      screenPageViews: 148,
      engagementRate: 0.67,
      newUsers: 21,
      eventCount: 280,
      keyEvents: 8,
    });
  });
});

describe("mapPagesReport", () => {
  it("keeps page path, title and engagement", () => {
    const [home] = mapPagesReport(fixture.pages ?? {});
    assert.equal(home.pagePath, "/");
    assert.equal(home.pageTitle, "Humana AI");
    assert.equal(home.screenPageViews, 80);
  });
});

describe("mapEventsReport", () => {
  it("maps key events separately from raw event counts", () => {
    const events = mapEventsReport(fixture.events ?? {});
    const lead = events.find((event) => event.eventName === "generate_lead");
    assert.equal(lead?.eventCount, 8);
    assert.equal(lead?.keyEvents, 8);
  });
});

describe("mapTrafficReport", () => {
  it("maps source and medium", () => {
    const [google] = mapTrafficReport(fixture.trafficSources ?? {});
    assert.deepEqual(google, {
      date: "2026-09-20",
      source: "google",
      medium: "organic",
      activeUsers: 24,
      sessions: 30,
    });
  });
});
