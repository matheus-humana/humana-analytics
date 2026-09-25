import assert from "node:assert/strict";
import test from "node:test";

import { collectRepos } from "./collect-repos.ts";
import { fetchGithubCollectPayload, probeGithubRepo } from "./client.ts";
import { parseGithubRepoList, readGithubConfig } from "./config.ts";
import { isGithubCronAuthorized } from "./cron-auth.ts";
import { githubPeriodWindow } from "./dates.ts";
import {
  parsePaths,
  parseReferrers,
  parseReleaseAssets,
  parseRepository,
  parseTrafficBody,
} from "./parse.ts";
import { buildRepoReport } from "./report.ts";
import { createMemoryGithubStore } from "./store.ts";

const viewsBody = {
  count: 14850,
  uniques: 3782,
  views: [
    { timestamp: "2016-10-10T00:00:00Z", count: 440, uniques: 143 },
    { timestamp: "2016-10-11T00:00:00Z", count: 1308, uniques: 414 },
  ],
};

const clonesBody = {
  count: 173,
  uniques: 128,
  clones: [
    { timestamp: "2016-10-10T00:00:00Z", count: 2, uniques: 1 },
    { timestamp: "2016-10-12T00:00:00Z", count: 3, uniques: 2 },
  ],
};

const referrersBody = [
  { referrer: "Google", count: 4, uniques: 3, actor: { login: "octocat" } },
];

const pathsBody = [
  { path: "/acme/widget", title: "widget", count: 20, uniques: 9 },
];

const repositoryBody = {
  full_name: "acme/widget",
  stargazers_count: 10,
  watchers_count: 10,
  forks_count: 2,
  subscribers_count: 4,
  owner: { login: "octocat" },
};

const releasesBody = [
  {
    tag_name: "v1.0.0",
    name: "First",
    author: { login: "octocat" },
    assets: [
      {
        name: "app.zip",
        download_count: 12,
        uploader: { login: "octocat" },
      },
    ],
  },
];

test("parsers keep aggregate counts and drop account logins", () => {
  const views = parseTrafficBody(viewsBody, "views");
  assert.equal(views.total, 14850);
  assert.equal(views.uniques, 3782);
  assert.equal(views.days[0]?.day, "2016-10-10");
  assert.equal(views.days[0]?.count, 440);

  const referrers = parseReferrers(referrersBody);
  const paths = parsePaths(pathsBody);
  const repo = parseRepository(repositoryBody);
  const assets = parseReleaseAssets(releasesBody);

  assert.equal(repo.watchers, 4);
  assert.equal(repo.stars, 10);
  assert.equal(assets[0]?.downloads, 12);
  const serialized = JSON.stringify({ referrers, paths, repo, assets });
  assert.equal(serialized.includes("octocat"), false);
  assert.equal(serialized.includes("login"), false);
});

test("repo config accepts several owner/name values and rejects a missing token", () => {
  const parsed = parseGithubRepoList("acme/widget, acme/other\nacme/widget");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.repos, ["acme/widget", "acme/other"]);

  const missing = readGithubConfig({ token: " ", repo: "acme/widget" });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.detail, "missing_token");

  const invalid = readGithubConfig({ token: "token", repo: "not a repo" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.detail, /^invalid_repo:/);
});

function mockFetch(routes: Record<string, { status?: number; body: unknown }>) {
  return async (url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer test-token");
    const path = new URL(url).pathname;
    const route = routes[path];
    if (!route) {
      return new Response(JSON.stringify({ message: `missing ${path}` }), { status: 404 });
    }
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

const happyRoutes = {
  "/repos/acme/widget": { body: repositoryBody },
  "/repos/acme/widget/traffic/views": { body: viewsBody },
  "/repos/acme/widget/traffic/clones": { body: clonesBody },
  "/repos/acme/widget/traffic/popular/referrers": { body: referrersBody },
  "/repos/acme/widget/traffic/popular/paths": { body: pathsBody },
  "/repos/acme/widget/releases": { body: releasesBody },
};

test("collection stores mocked traffic and a second run does not duplicate the day", async () => {
  const store = createMemoryGithubStore();
  const fetchImpl = mockFetch(happyRoutes);

  const first = await collectRepos({
    repos: ["acme/widget"],
    token: "test-token",
    collectedOn: "2016-10-12",
    store,
    projectIdFor: async () => "proj_github",
    fetchImpl,
  });
  const second = await collectRepos({
    repos: ["acme/widget"],
    token: "test-token",
    collectedOn: "2016-10-12",
    store,
    projectIdFor: async () => "proj_github",
    fetchImpl,
  });

  assert.equal(first[0]?.ok, true);
  assert.equal(second[0]?.ok, true);
  assert.equal(store.trafficCount(), 3);
  assert.equal(store.repoDayCount(), 1);

  const days = await store.listTrafficDays("acme/widget");
  const oct10 = days.find((day) => day.day === "2016-10-10");
  const oct12 = days.find((day) => day.day === "2016-10-12");
  assert.equal(oct10?.views, 440);
  assert.equal(oct10?.clones, 2);
  assert.equal(oct12?.views, null);
  assert.equal(oct12?.clones, 3);

  const snapshot = (await store.listRepoDays("acme/widget"))[0];
  assert.equal(snapshot?.stars, 10);
  assert.equal(snapshot?.watchers, 4);
  assert.equal(snapshot?.releaseDownloads, 12);
  assert.equal(snapshot?.uniqueViews14d, 3782);
  assert.equal(JSON.stringify(snapshot).includes("octocat"), false);
});

test("a later collect updates the same day instead of inserting another row", async () => {
  const store = createMemoryGithubStore();
  await collectRepos({
    repos: ["acme/widget"],
    token: "test-token",
    collectedOn: "2016-10-12",
    store,
    projectIdFor: async () => "proj_github",
    fetchImpl: mockFetch(happyRoutes),
  });

  const updatedViews = {
    ...viewsBody,
    views: [{ timestamp: "2016-10-10T00:00:00Z", count: 500, uniques: 150 }],
  };
  await collectRepos({
    repos: ["acme/widget"],
    token: "test-token",
    collectedOn: "2016-10-12",
    store,
    projectIdFor: async () => "proj_github",
    fetchImpl: mockFetch({
      ...happyRoutes,
      "/repos/acme/widget/traffic/views": { body: updatedViews },
      "/repos/acme/widget": {
        body: { ...repositoryBody, stargazers_count: 11 },
      },
    }),
  });

  assert.equal(store.trafficCount(), 3);
  assert.equal(store.repoDayCount(), 1);
  const oct10 = (await store.listTrafficDays("acme/widget")).find((day) => day.day === "2016-10-10");
  assert.equal(oct10?.views, 500);
  assert.equal(oct10?.clones, 2);
  const snapshot = (await store.listRepoDays("acme/widget"))[0];
  assert.equal(snapshot?.stars, 11);
});

test("a 403 does not write a snapshot and keeps the GitHub message", async () => {
  const store = createMemoryGithubStore();
  const results = await collectRepos({
    repos: ["acme/widget"],
    token: "test-token",
    collectedOn: "2016-10-12",
    store,
    projectIdFor: async () => "proj_github",
    fetchImpl: mockFetch({
      ...happyRoutes,
      "/repos/acme/widget/traffic/views": {
        status: 403,
        body: { message: "Must have push access to repository" },
      },
    }),
  });

  assert.equal(results[0]?.ok, false);
  assert.match(results[0]?.error ?? "", /GitHub 403: Must have push access to repository/);
  assert.equal(store.trafficCount(), 0);
  assert.equal(store.repoDayCount(), 0);

  const probe = await probeGithubRepo(
    "acme/widget",
    "test-token",
    mockFetch({
      "/repos/acme/widget/traffic/views": {
        status: 403,
        body: { message: "Must have push access to repository" },
      },
    })
  );
  assert.equal(probe.ok, false);
  if (!probe.ok) assert.match(probe.message, /GitHub 403/);
});

test("the report sums recorded view counts and does not invent missing days or period uniques", async () => {
  const payload = await fetchGithubCollectPayload({
    repo: "acme/widget",
    token: "test-token",
    projectId: "proj_github",
    collectedOn: "2016-10-12",
    fetchImpl: mockFetch(happyRoutes),
  });
  const report = buildRepoReport({
    repo: "acme/widget",
    projectId: "proj_github",
    projectName: "GitHub acme/widget",
    from: "2016-10-10",
    to: "2016-10-12",
    periodDays: 3,
    traffic: payload.traffic,
    repoDays: [payload.repoDay],
  });

  assert.deepEqual(
    report.traffic.map((point) => point.day),
    ["2016-10-10", "2016-10-11", "2016-10-12"]
  );
  assert.equal(report.views, 440 + 1308);
  assert.equal(report.clones, 2 + 3);
  assert.equal(report.uniqueViews14d, 3782);
  assert.equal("periodUniques" in report, false);
  assert.equal(report.traffic.find((point) => point.day === "2016-10-11")?.clones, null);
  assert.equal(report.counters?.stars, 10);
  assert.equal(githubPeriodWindow("7d", "2016-10-12").from, "2016-10-06");
});

test("cron authorization requires the bearer secret", () => {
  const env = { cronSecret: "cron-secret", githubCronSecret: null };
  const allowed = new Request("https://analytics.example/api/github/collect", {
    headers: { authorization: "Bearer cron-secret" },
  });
  const rejected = new Request("https://analytics.example/api/github/collect", {
    headers: { authorization: "Bearer other" },
  });
  assert.equal(isGithubCronAuthorized(allowed, env), true);
  assert.equal(isGithubCronAuthorized(rejected, env), false);
  assert.equal(isGithubCronAuthorized(new Request("https://analytics.example"), env), false);
});
