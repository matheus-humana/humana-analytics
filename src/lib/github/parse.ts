import { dayFromTimestamp } from "./dates";
import type { GithubAsset, GithubPath, GithubReferrer } from "./types";

export class GithubParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubParseError";
  }
}

export type TrafficBucket = {
  total: number;
  uniques: number;
  days: Array<{ day: string; count: number; uniques: number }>;
};

export type GithubRepositoryCounts = {
  stars: number;
  forks: number;
  watchers: number;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GithubParseError(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function readCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new GithubParseError(`Missing or invalid ${field}`);
  }
  return value;
}

function readText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GithubParseError(`Missing or invalid ${field}`);
  }
  return value.trim().slice(0, 300);
}

export function parseTrafficBody(body: unknown, listKey: "views" | "clones"): TrafficBucket {
  const record = asRecord(body, listKey);
  const total = readCount(record.count, `${listKey}.count`);
  const uniques = readCount(record.uniques, `${listKey}.uniques`);
  const list = record[listKey];
  if (!Array.isArray(list)) {
    throw new GithubParseError(`${listKey} list is missing`);
  }

  const days: TrafficBucket["days"] = [];
  for (const item of list) {
    const row = asRecord(item, listKey);
    const timestamp = row.timestamp;
    if (typeof timestamp !== "string") {
      throw new GithubParseError(`${listKey} timestamp is missing`);
    }
    const day = dayFromTimestamp(timestamp);
    if (!day) throw new GithubParseError(`${listKey} timestamp is invalid`);
    days.push({
      day,
      count: readCount(row.count, `${listKey}.count`),
      uniques: readCount(row.uniques, `${listKey}.uniques`),
    });
  }

  return { total, uniques, days };
}

export function parseReferrers(body: unknown): GithubReferrer[] {
  if (!Array.isArray(body)) throw new GithubParseError("referrers is not a list");
  return body.map((item) => {
    const row = asRecord(item, "referrer");
    return {
      referrer: readText(row.referrer, "referrer"),
      count: readCount(row.count, "referrer.count"),
      uniques: readCount(row.uniques, "referrer.uniques"),
    };
  });
}

export function parsePaths(body: unknown): GithubPath[] {
  if (!Array.isArray(body)) throw new GithubParseError("paths is not a list");
  return body.map((item) => {
    const row = asRecord(item, "path");
    return {
      path: readText(row.path, "path"),
      title: readText(row.title, "path.title"),
      count: readCount(row.count, "path.count"),
      uniques: readCount(row.uniques, "path.uniques"),
    };
  });
}

export function parseRepository(body: unknown): GithubRepositoryCounts {
  const row = asRecord(body, "repository");
  return {
    stars: readCount(row.stargazers_count, "stargazers_count"),
    forks: readCount(row.forks_count, "forks_count"),
    watchers: readCount(row.subscribers_count, "subscribers_count"),
  };
}

export function parseReleaseAssets(body: unknown): GithubAsset[] {
  if (!Array.isArray(body)) throw new GithubParseError("releases is not a list");
  const assets: GithubAsset[] = [];
  for (const release of body) {
    const row = asRecord(release, "release");
    const tag = readText(row.tag_name, "tag_name");
    const name =
      typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 300) : tag;
    const list = row.assets;
    if (!Array.isArray(list)) continue;
    for (const asset of list) {
      const item = asRecord(asset, "asset");
      assets.push({
        tag,
        release: name,
        name: readText(item.name, "asset.name"),
        downloads: readCount(item.download_count, "download_count"),
      });
    }
  }
  return assets;
}

export function sumDownloads(assets: GithubAsset[]): number {
  return assets.reduce((sum, asset) => sum + asset.downloads, 0);
}
