import { addUtcDays, previousWindow } from "./dates";
import type {
  GithubCounterPoint,
  GithubRepoReport,
  RepoDayRow,
  TrafficDayRow,
} from "./types";

function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value != null);
  if (known.length === 0) return null;
  return known.reduce((sum, value) => sum + value, 0);
}

export function buildRepoReport(input: {
  repo: string;
  projectId: string;
  projectName: string;
  from: string;
  to: string;
  periodDays: number;
  traffic: TrafficDayRow[];
  repoDays: RepoDayRow[];
}): GithubRepoReport {
  const previous = previousWindow(input.from, input.periodDays);
  const traffic = input.traffic
    .filter((row) => row.repo === input.repo && inRange(row.day, input.from, input.to))
    .sort((a, b) => a.day.localeCompare(b.day));
  const previousTraffic = input.traffic.filter(
    (row) => row.repo === input.repo && inRange(row.day, previous.from, previous.to)
  );
  const repoDays = input.repoDays
    .filter((row) => row.repo === input.repo && inRange(row.day, input.from, input.to))
    .sort((a, b) => a.day.localeCompare(b.day));
  const latest = repoDays[repoDays.length - 1] ?? null;

  const counterSeries: GithubCounterPoint[] = repoDays.map((row) => ({
    day: row.day,
    stars: row.stars,
    forks: row.forks,
    watchers: row.watchers,
    releaseDownloads: row.releaseDownloads,
  }));

  return {
    repo: input.repo,
    projectId: input.projectId,
    projectName: input.projectName,
    from: input.from,
    to: input.to,
    traffic: traffic.map((row) => ({
      day: row.day,
      views: row.views,
      uniqueViews: row.uniqueViews,
      clones: row.clones,
      uniqueClones: row.uniqueClones,
    })),
    views: sumKnown(traffic.map((row) => row.views)),
    clones: sumKnown(traffic.map((row) => row.clones)),
    recordedDays: traffic.length,
    previousViews: sumKnown(previousTraffic.map((row) => row.views)),
    previousClones: sumKnown(previousTraffic.map((row) => row.clones)),
    previousRecordedDays: previousTraffic.length,
    uniqueViews14d: latest?.uniqueViews14d ?? null,
    uniqueClones14d: latest?.uniqueClones14d ?? null,
    views14d: latest?.views14d ?? null,
    clones14d: latest?.clones14d ?? null,
    windowCollectedOn: latest?.day ?? null,
    counters: latest
      ? {
          day: latest.day,
          stars: latest.stars,
          forks: latest.forks,
          watchers: latest.watchers,
          releaseDownloads: latest.releaseDownloads,
        }
      : null,
    counterSeries,
    referrers: latest?.referrers ?? [],
    paths: latest?.paths ?? [],
    assets: latest?.assets ?? [],
  };
}

export function hasSnapshot(report: GithubRepoReport): boolean {
  return report.recordedDays > 0 || report.counters != null;
}

export function shiftDay(day: string, delta: number): string {
  return addUtcDays(day, delta);
}
