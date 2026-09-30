import { hasGithubConfig } from "@/lib/github/config";
import { queryGithubForChat } from "@/lib/github/chat";

import { PERIOD_PARAMETER, parseToolArgs } from "./period";
import { notConnected, queryFailed } from "./results";

const SOURCE = "GitHub";

export const githubToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_github_overview",
      description:
        "GitHub repository snapshot: stars, forks, watchers, release-asset downloads, and the latest 14-day view and clone totals. Counters are the value recorded on that day. Uniques are GitHub's 14-day window, not a sum of daily uniques.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_github_traffic",
      description:
        "GitHub views and clones by day from stored snapshots, plus the sum of recorded days in the period. Missing days are omitted. Daily uniques must not be added together.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_github_referrers",
      description:
        "GitHub top referrers and top content paths. Both lists are GitHub's rolling 14-day window from the latest snapshot in the period.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_github_downloads",
      description:
        "GitHub release asset download_count values from the latest snapshot in the period. This is not the source-zip download button; GitHub does not publish that count.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
] as const;

type ChatReport = Awaited<ReturnType<typeof queryGithubForChat>>;

function readyRepos(report: ChatReport) {
  if (!("repos" in report) || !Array.isArray(report.repos)) return null;
  const repos = report.repos.filter(
    (repo): repo is Exclude<(typeof report.repos)[number], string> =>
      typeof repo === "object" && repo != null && "views" in repo
  );
  return repos.length > 0 ? repos : null;
}

export async function executeGithubTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  if (!hasGithubConfig()) return notConnected(SOURCE);

  const args = parseToolArgs(rawArgs);
  const period = args.period ?? defaultPeriod;

  try {
    const report = await queryGithubForChat(period);
    const repos = readyRepos(report);
    if (!report.connected || !repos) return report;

    const shared = {
      source: SOURCE,
      connected: true as const,
      periodId: period,
      period: "period" in report ? report.period : period,
      from: "from" in report ? report.from : null,
      to: "to" in report ? report.to : null,
      note: "note" in report ? report.note : null,
    };

    if (name === "get_github_overview") {
      return {
        ...shared,
        repos: repos.map((repo) => ({
          repo: repo.repo,
          project: repo.project,
          windowCollectedOn: repo.windowCollectedOn,
          stars: repo.counters?.stars ?? null,
          forks: repo.counters?.forks ?? null,
          watchers: repo.counters?.watchers ?? null,
          releaseDownloads: repo.counters?.releaseDownloads ?? null,
          counterDay: repo.counters?.day ?? null,
          views: repo.views,
          clones: repo.clones,
          recordedDays: repo.recordedDays,
          views14d: repo.views14d,
          uniqueViews14d: repo.uniqueViews14d,
          clones14d: repo.clones14d,
          uniqueClones14d: repo.uniqueClones14d,
        })),
      };
    }

    if (name === "get_github_traffic") {
      return {
        ...shared,
        repos: repos.map((repo) => ({
          repo: repo.repo,
          views: repo.views,
          clones: repo.clones,
          recordedDays: repo.recordedDays,
          previousViews: repo.previousViews,
          previousClones: repo.previousClones,
          daily: repo.daily.slice(0, 8),
        })),
      };
    }

    if (name === "get_github_referrers") {
      return {
        ...shared,
        repos: repos.map((repo) => ({
          repo: repo.repo,
          windowCollectedOn: repo.windowCollectedOn,
          referrers: repo.referrers,
          paths: repo.paths,
        })),
      };
    }

    if (name === "get_github_downloads") {
      return {
        ...shared,
        repos: repos.map((repo) => ({
          repo: repo.repo,
          counterDay: repo.counters?.day ?? null,
          releaseDownloads: repo.counters?.releaseDownloads ?? null,
          assets: repo.assets,
        })),
      };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (error) {
    return queryFailed(SOURCE, error);
  }
}
