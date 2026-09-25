import type { GithubFetch } from "./client";
import { fetchGithubCollectPayload } from "./client";
import type { GithubSnapshotStore } from "./store";

export type RepoCollectResult = {
  repo: string;
  ok: boolean;
  error?: string;
  trafficDays?: number;
  snapshotDay?: string;
};

/**
 * Fetches one repository and upserts the snapshot.
 * A failed request writes nothing for that repository.
 * Running the same day again updates the existing rows.
 */
export async function collectRepos(input: {
  repos: string[];
  token: string;
  collectedOn: string;
  store: GithubSnapshotStore;
  projectIdFor: (repo: string) => Promise<string>;
  fetchImpl?: GithubFetch;
}): Promise<RepoCollectResult[]> {
  const results: RepoCollectResult[] = [];

  for (const repo of input.repos) {
    try {
      const projectId = await input.projectIdFor(repo);
      const payload = await fetchGithubCollectPayload({
        repo,
        token: input.token,
        projectId,
        collectedOn: input.collectedOn,
        fetchImpl: input.fetchImpl,
      });
      if (payload.traffic.length > 0) {
        await input.store.upsertTrafficDays(payload.traffic);
      }
      await input.store.upsertRepoDay(payload.repoDay);
      results.push({
        repo,
        ok: true,
        trafficDays: payload.traffic.length,
        snapshotDay: payload.repoDay.day,
      });
    } catch (error) {
      results.push({
        repo,
        ok: false,
        error: error instanceof Error ? error.message : "GitHub collect failed",
      });
    }
  }

  return results;
}
