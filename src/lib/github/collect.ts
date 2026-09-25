import { readGithubConfig } from "./config";
import { collectRepos, type RepoCollectResult } from "./collect-repos";
import { utcDay } from "./dates";
import { createPostgresGithubStore } from "./postgres-store";
import { ensureGithubProject, markGithubSource } from "./projects";
import { clearGithubProbeCache } from "./status";
import type { GithubFetch } from "./client";

export type GithubCollectionResponse = {
  ok: boolean;
  error?: string;
  results: RepoCollectResult[];
};

export async function runGithubCollection(options?: {
  fetchImpl?: GithubFetch;
  now?: Date;
}): Promise<GithubCollectionResponse> {
  clearGithubProbeCache();
  const config = readGithubConfig();
  if (!config.ok) {
    return { ok: false, error: config.detail, results: [] };
  }

  const collectedOn = utcDay(options?.now ?? new Date());
  const store = createPostgresGithubStore();
  const results = await collectRepos({
    repos: config.repos,
    token: config.token,
    collectedOn,
    store,
    fetchImpl: options?.fetchImpl,
    projectIdFor: async (repo) => {
      const project = await ensureGithubProject(repo);
      return project.id;
    },
  });

  for (const result of results) {
    try {
      const project = await ensureGithubProject(result.repo);
      await markGithubSource(project.id, result.ok ? "active" : "error");
    } catch {
      // The collect result still reports the GitHub error.
    }
  }

  const failed = results.filter((result) => !result.ok);
  return {
    ok: failed.length === 0,
    error: failed[0]?.error,
    results,
  };
}
