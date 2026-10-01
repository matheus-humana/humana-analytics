import assert from "node:assert/strict";
import test from "node:test";

import { toolSources } from "./thinking-stage.ts";

test("tool rounds map to their data sources once, in call order", () => {
  assert.deepEqual(
    toolSources(["get_github_traffic", "get_overview", "get_top_pages", "get_github_referrers"]),
    ["github", "ga4"]
  );
});

test("seo, geo, and web search are separate sources", () => {
  assert.deepEqual(
    toolSources(["get_geo_overview", "get_seo_overview", "search_web"]),
    ["geo", "seo", "web"]
  );
});

test("unknown tools and empty rounds fall back to plain thinking", () => {
  assert.deepEqual(toolSources(["get_project_context", "made_up"]), []);
  assert.deepEqual(toolSources([]), []);
});
