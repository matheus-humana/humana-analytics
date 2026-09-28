import type { AnalyticsPeriodId } from "@/lib/analytics/period";

/** GitHub repo `owner/name`. Never a hardcoded launch repository. */
export type GithubRepoName = string;

export type GithubReferrer = {
  referrer: string;
  count: number;
  uniques: number;
};

export type GithubPath = {
  path: string;
  title: string;
  count: number;
  uniques: number;
};

export type GithubAsset = {
  tag: string;
  release: string;
  name: string;
  downloads: number;
};

export type TrafficDayRow = {
  repo: string;
  projectId: string;
  day: string;
  views: number | null;
  uniqueViews: number | null;
  clones: number | null;
  uniqueClones: number | null;
};

export type RepoDayRow = {
  repo: string;
  projectId: string;
  day: string;
  stars: number;
  forks: number;
  /** `subscribers_count`. GitHub's `watchers_count` repeats stars and is not stored. */
  watchers: number;
  releaseDownloads: number;
  /** Top-level totals from the traffic API (rolling 14 days), not a sum of daily uniques. */
  views14d: number;
  uniqueViews14d: number;
  clones14d: number;
  uniqueClones14d: number;
  referrers: GithubReferrer[];
  paths: GithubPath[];
  assets: GithubAsset[];
};

export type GithubTrafficPoint = {
  day: string;
  views: number | null;
  uniqueViews: number | null;
  clones: number | null;
  uniqueClones: number | null;
};

export type GithubCounterPoint = {
  day: string;
  stars: number;
  forks: number;
  watchers: number;
  releaseDownloads: number;
};

export type GithubRepoReport = {
  repo: string;
  projectId: string;
  projectName: string;
  from: string;
  to: string;
  traffic: GithubTrafficPoint[];
  views: number | null;
  clones: number | null;
  recordedDays: number;
  previousViews: number | null;
  previousClones: number | null;
  previousRecordedDays: number;
  uniqueViews14d: number | null;
  uniqueClones14d: number | null;
  views14d: number | null;
  clones14d: number | null;
  windowCollectedOn: string | null;
  counters: GithubCounterPoint | null;
  counterSeries: GithubCounterPoint[];
  referrers: GithubReferrer[];
  paths: GithubPath[];
  assets: GithubAsset[];
};

export type GithubPanelRepo = {
  repo: string;
  projectId: string | null;
  projectName: string | null;
  ok: boolean;
  message: string | null;
  report: GithubRepoReport | null;
};

export type GithubPanelData = {
  configured: boolean;
  status: "not_connected" | "active" | "error";
  detail: string | null;
  periodId: AnalyticsPeriodId;
  from: string;
  to: string;
  today: string;
  /** ISO time of the latest stored collect. Null when nothing has been stored. */
  collectedAt: string | null;
  repos: GithubPanelRepo[];
};

export const GITHUB_MISSING_TOKEN = "missing_token";
export const GITHUB_MISSING_REPO = "missing_repo";
export const GITHUB_INVALID_REPO = "invalid_repo";
