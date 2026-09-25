import { resolveAnalyticsPeriod } from "@/lib/analytics/period";

import { loadGithubPanel } from "./panel";
import { hasSnapshot } from "./report";
import type { GithubRepoReport } from "./types";

const SOURCE = "GitHub";

const SNAPSHOT_NOTE =
  "Counts are daily snapshots. views and clones are sums of recorded days in the period (missing days are omitted, not treated as zero). uniqueViews14d and uniqueClones14d are GitHub's rolling 14-day uniques from the latest snapshot in the period; do not add daily uniques together. stars, forks, watchers and releaseDownloads are the counter recorded on counters.day. Referrers and paths are GitHub's 14-day window from that same snapshot. Release downloads count release assets only; GitHub does not publish source-zip downloads. No user logins are included.";

function publicReport(report: GithubRepoReport) {
  return {
    repo: report.repo,
    project: report.projectName,
    period: { from: report.from, to: report.to },
    recordedDays: report.recordedDays,
    views: report.views,
    clones: report.clones,
    previousViews: report.previousViews,
    previousClones: report.previousClones,
    views14d: report.views14d,
    uniqueViews14d: report.uniqueViews14d,
    clones14d: report.clones14d,
    uniqueClones14d: report.uniqueClones14d,
    windowCollectedOn: report.windowCollectedOn,
    counters: report.counters,
    counterSeries: report.counterSeries,
    daily: report.traffic,
    referrers: report.referrers,
    paths: report.paths,
    assets: report.assets,
  };
}

export async function queryGithubForChat(periodValue: string | null | undefined) {
  const period = resolveAnalyticsPeriod(periodValue);
  try {
    const panel = await loadGithubPanel(period.id);
    if (!panel.configured) {
      return {
        source: SOURCE,
        connected: false as const,
        instruction:
          "GitHub is not configured. Tell the user to set GITHUB_TOKEN and GITHUB_REPO. Do not invent metrics.",
        error: panel.detail,
      };
    }

    const failed = panel.repos.filter((repo) => !repo.ok);
    const ready = panel.repos.filter(
      (repo) => repo.ok && repo.report && hasSnapshot(repo.report)
    );

    if (ready.length === 0) {
      return {
        source: SOURCE,
        connected: failed.length > 0 ? (false as const) : (true as const),
        snapshots: false as const,
        instruction: failed.length
          ? "GitHub refused the request. Explain the error. Do not invent metrics."
          : "GitHub is connected but no daily snapshot is stored yet. Tell the user to run the collect job. Do not invent metrics.",
        error: failed.length ? panel.detail : null,
        repos: panel.repos.map((repo) => repo.repo),
      };
    }

    return {
      source: SOURCE,
      connected: true as const,
      period: period.label,
      from: panel.from,
      to: panel.to,
      note: SNAPSHOT_NOTE,
      repos: ready.map((repo) => publicReport(repo.report!)),
      errors: failed.map((repo) => ({ repo: repo.repo, error: repo.message })),
    };
  } catch (error) {
    return {
      source: SOURCE,
      connected: false as const,
      instruction:
        "GitHub snapshots could not be read. Explain the error. Do not invent metrics.",
      error: error instanceof Error ? error.message : "GitHub query failed",
    };
  }
}

export async function loadGithubBridgeSummary() {
  const summary = await queryGithubForChat("7d");
  return summary;
}
