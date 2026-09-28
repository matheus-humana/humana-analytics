import { githubPeriodWindow, utcDay } from "./dates";
import { ensureGithubProject } from "./projects";
import { createPostgresGithubStore } from "./postgres-store";
import { buildRepoReport } from "./report";
import { getGithubConnectionStatus } from "./status";
import { readGithubConfig } from "./config";
import type { GithubPanelData, GithubPanelRepo, GithubRepoReport } from "./types";
import type { AnalyticsPeriodId } from "@/lib/analytics/period";

async function reportForRepo(input: {
  repo: string;
  periodId: AnalyticsPeriodId;
  today: string;
}): Promise<{ projectId: string; projectName: string; report: GithubRepoReport }> {
  const project = await ensureGithubProject(input.repo);
  const store = createPostgresGithubStore();
  const [traffic, repoDays] = await Promise.all([
    store.listTrafficDays(input.repo),
    store.listRepoDays(input.repo),
  ]);
  const window = githubPeriodWindow(input.periodId, input.today);
  return {
    projectId: project.id,
    projectName: project.name,
    report: buildRepoReport({
      repo: input.repo,
      projectId: project.id,
      projectName: project.name,
      from: window.from,
      to: window.to,
      periodDays: window.days,
      traffic,
      repoDays,
    }),
  };
}

export async function loadGithubPanel(
  periodId: AnalyticsPeriodId,
  now = new Date()
): Promise<GithubPanelData> {
  const today = utcDay(now);
  const window = githubPeriodWindow(periodId, today);
  const config = readGithubConfig();
  const base = {
    periodId,
    from: window.from,
    to: window.to,
    today,
    collectedAt: null,
  };

  if (!config.ok) {
    return {
      ...base,
      configured: false,
      status: "not_connected",
      detail: config.detail,
      repos: [],
    };
  }

  const status = await getGithubConnectionStatus();
  const repos: GithubPanelRepo[] = [];

  for (const repo of config.repos) {
    const failure = status.detail?.includes(`${repo}: `)
      ? status.detail
          .split(" · ")
          .find((part) => part.startsWith(`${repo}: `))
          ?.slice(repo.length + 2) ?? status.detail
      : null;

    if (status.status === "error" && failure) {
      repos.push({
        repo,
        projectId: null,
        projectName: null,
        ok: false,
        message: failure,
        report: null,
      });
      continue;
    }

    try {
      const loaded = await reportForRepo({ repo, periodId, today });
      repos.push({
        repo,
        projectId: loaded.projectId,
        projectName: loaded.projectName,
        ok: true,
        message: null,
        report: loaded.report,
      });
    } catch (error) {
      repos.push({
        repo,
        projectId: null,
        projectName: null,
        ok: false,
        message: error instanceof Error ? error.message : "Failed to read GitHub snapshots",
        report: null,
      });
    }
  }

  const anyError = repos.some((repo) => !repo.ok);
  return {
    ...base,
    configured: true,
    status: anyError ? "error" : "active",
    detail: anyError
      ? repos
          .filter((repo) => !repo.ok && repo.message)
          .map((repo) => `${repo.repo}: ${repo.message}`)
          .join(" · ")
      : null,
    collectedAt: status.updatedAt,
    repos,
  };
}
