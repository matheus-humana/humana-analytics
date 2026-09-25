import { dayFromTimestamp } from "./dates";
import {
  parsePaths,
  parseReferrers,
  parseReleaseAssets,
  parseRepository,
  parseTrafficBody,
  sumDownloads,
  type TrafficBucket,
} from "./parse";
import type { RepoDayRow, TrafficDayRow } from "./types";

export class GithubRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(status > 0 ? `GitHub ${status}: ${message}` : message);
    this.name = "GithubRequestError";
    this.status = status;
  }
}

export type GithubFetch = (url: string, init: RequestInit) => Promise<Response>;

const API = "https://api.github.com";

function sanitizeMessage(message: string): string {
  return message
    .replace(/\b(?:ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

async function readGithubError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return sanitizeMessage(body.message);
    }
  } catch {
    // Fall through to the status text.
  }
  return sanitizeMessage(response.statusText || "request failed");
}

function assertGithubUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "api.github.com") {
    throw new GithubRequestError(0, "Refused a non-GitHub URL");
  }
  return parsed.toString();
}

async function githubGet(
  url: string,
  token: string,
  fetchImpl: GithubFetch
): Promise<{ body: unknown; link: string | null }> {
  const response = await fetchImpl(assertGithubUrl(url), {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "humana-analytics",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new GithubRequestError(response.status, await readGithubError(response));
  }

  return { body: await response.json(), link: response.headers.get("link") };
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function githubGetAll(
  path: string,
  token: string,
  fetchImpl: GithubFetch
): Promise<unknown[]> {
  const pages: unknown[] = [];
  let url: string | null = `${API}${path}`;
  for (let page = 0; url && page < 5; page += 1) {
    const result = await githubGet(url, token, fetchImpl);
    if (!Array.isArray(result.body)) {
      throw new GithubRequestError(0, "GitHub list response was not a list");
    }
    pages.push(...result.body);
    url = nextLink(result.link);
  }
  return pages;
}

function mergeDays(
  repo: string,
  projectId: string,
  views: TrafficBucket,
  clones: TrafficBucket
): TrafficDayRow[] {
  const byDay = new Map<string, TrafficDayRow>();
  for (const day of views.days) {
    byDay.set(day.day, {
      repo,
      projectId,
      day: day.day,
      views: day.count,
      uniqueViews: day.uniques,
      clones: null,
      uniqueClones: null,
    });
  }
  for (const day of clones.days) {
    const current = byDay.get(day.day);
    byDay.set(day.day, {
      repo,
      projectId,
      day: day.day,
      views: current?.views ?? null,
      uniqueViews: current?.uniqueViews ?? null,
      clones: day.count,
      uniqueClones: day.uniques,
    });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function fetchGithubCollectPayload(input: {
  repo: string;
  token: string;
  projectId: string;
  collectedOn: string;
  fetchImpl?: GithubFetch;
}): Promise<{ traffic: TrafficDayRow[]; repoDay: RepoDayRow }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const encoded = input.repo
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const base = `/repos/${encoded}`;

  const [repository, views, clones, referrers, paths, releases] = await Promise.all([
    githubGet(`${API}${base}`, input.token, fetchImpl),
    githubGet(`${API}${base}/traffic/views`, input.token, fetchImpl),
    githubGet(`${API}${base}/traffic/clones`, input.token, fetchImpl),
    githubGet(`${API}${base}/traffic/popular/referrers`, input.token, fetchImpl),
    githubGet(`${API}${base}/traffic/popular/paths`, input.token, fetchImpl),
    githubGetAll(`${base}/releases?per_page=100`, input.token, fetchImpl),
  ]);

  const counts = parseRepository(repository.body);
  const viewBucket = parseTrafficBody(views.body, "views");
  const cloneBucket = parseTrafficBody(clones.body, "clones");
  const assets = parseReleaseAssets(releases);
  const collectedOn = dayFromTimestamp(input.collectedOn) ?? input.collectedOn;

  return {
    traffic: mergeDays(input.repo, input.projectId, viewBucket, cloneBucket),
    repoDay: {
      repo: input.repo,
      projectId: input.projectId,
      day: collectedOn,
      stars: counts.stars,
      forks: counts.forks,
      watchers: counts.watchers,
      releaseDownloads: sumDownloads(assets),
      views14d: viewBucket.total,
      uniqueViews14d: viewBucket.uniques,
      clones14d: cloneBucket.total,
      uniqueClones14d: cloneBucket.uniques,
      referrers: parseReferrers(referrers.body),
      paths: parsePaths(paths.body),
      assets,
    },
  };
}

export async function probeGithubRepo(
  repo: string,
  token: string,
  fetchImpl?: GithubFetch
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fetchImplResolved = fetchImpl ?? fetch;
  const encoded = repo
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  try {
    await githubGet(
      `${API}/repos/${encoded}/traffic/views`,
      token,
      fetchImplResolved
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "GitHub request failed",
    };
  }
}
