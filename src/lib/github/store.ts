import type { RepoDayRow, TrafficDayRow } from "./types";

export type GithubSnapshotStore = {
  upsertTrafficDays(rows: TrafficDayRow[]): Promise<void>;
  upsertRepoDay(row: RepoDayRow): Promise<void>;
  listTrafficDays(repo: string): Promise<TrafficDayRow[]>;
  listRepoDays(repo: string): Promise<RepoDayRow[]>;
};

export function mergeTrafficDay(
  previous: TrafficDayRow | undefined,
  next: TrafficDayRow
): TrafficDayRow {
  if (!previous) return { ...next };
  return {
    repo: next.repo,
    projectId: next.projectId,
    day: next.day,
    views: next.views ?? previous.views,
    uniqueViews: next.uniqueViews ?? previous.uniqueViews,
    clones: next.clones ?? previous.clones,
    uniqueClones: next.uniqueClones ?? previous.uniqueClones,
  };
}

export function createMemoryGithubStore(): GithubSnapshotStore & {
  trafficCount(): number;
  repoDayCount(): number;
} {
  const traffic = new Map<string, TrafficDayRow>();
  const repoDays = new Map<string, RepoDayRow>();

  function key(repo: string, day: string): string {
    return `${repo}\n${day}`;
  }

  return {
    async upsertTrafficDays(rows) {
      for (const row of rows) {
        const id = key(row.repo, row.day);
        traffic.set(id, mergeTrafficDay(traffic.get(id), row));
      }
    },
    async upsertRepoDay(row) {
      repoDays.set(key(row.repo, row.day), {
        ...row,
        referrers: row.referrers.map((item) => ({ ...item })),
        paths: row.paths.map((item) => ({ ...item })),
        assets: row.assets.map((item) => ({ ...item })),
      });
    },
    async listTrafficDays(repo) {
      return [...traffic.values()]
        .filter((row) => row.repo === repo)
        .sort((a, b) => a.day.localeCompare(b.day));
    },
    async listRepoDays(repo) {
      return [...repoDays.values()]
        .filter((row) => row.repo === repo)
        .sort((a, b) => a.day.localeCompare(b.day));
    },
    trafficCount() {
      return traffic.size;
    },
    repoDayCount() {
      return repoDays.size;
    },
  };
}
