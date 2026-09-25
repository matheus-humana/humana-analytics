import { desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { githubRepoDays } from "@/lib/db/schema";

import { probeGithubRepo, type GithubFetch } from "./client";
import { readGithubConfig } from "./config";

export type GithubProbe = { ok: true } | { ok: false; message: string };

type CacheEntry = { at: number; value: GithubProbe };

const CACHE_MS = 60_000;
const probeCache = new Map<string, CacheEntry>();
const probeInflight = new Map<string, Promise<GithubProbe>>();

export function clearGithubProbeCache(): void {
  probeCache.clear();
  probeInflight.clear();
}

export async function probeGithubRepoCached(
  repo: string,
  token: string,
  fetchImpl?: GithubFetch
): Promise<GithubProbe> {
  const hit = probeCache.get(repo);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const pending = probeInflight.get(repo);
  if (pending) return pending;

  const request = probeGithubRepo(repo, token, fetchImpl)
    .then((value) => {
      probeCache.set(repo, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      probeInflight.delete(repo);
    });
  probeInflight.set(repo, request);
  return request;
}

export type GithubConnectionStatus = {
  connected: boolean;
  status: "active" | "error" | "not_connected";
  detail: string | null;
  repos: string[];
  updatedAt: string | null;
};

async function latestSnapshotAt(): Promise<string | null> {
  try {
    const row = (
      await db
        .select({ collectedAt: githubRepoDays.collectedAt })
        .from(githubRepoDays)
        .orderBy(desc(githubRepoDays.collectedAt))
        .limit(1)
    )[0];
    return row?.collectedAt.toISOString() ?? null;
  } catch {
    return null;
  }
}

export async function getGithubConnectionStatus(options?: {
  fetchImpl?: GithubFetch;
}): Promise<GithubConnectionStatus> {
  const config = readGithubConfig();
  if (!config.ok) {
    return {
      connected: false,
      status: "not_connected",
      detail: config.detail,
      repos: [],
      updatedAt: null,
    };
  }

  const probes = await Promise.all(
    config.repos.map(async (repo) => ({
      repo,
      probe: await probeGithubRepoCached(repo, config.token, options?.fetchImpl),
    }))
  );
  const failures = probes.filter((item) => !item.probe.ok);
  const updatedAt = failures.length === 0 ? await latestSnapshotAt() : null;

  if (failures.length > 0) {
    return {
      connected: false,
      status: "error",
      detail: failures
        .map((item) =>
          item.probe.ok ? "" : `${item.repo}: ${item.probe.message}`
        )
        .filter(Boolean)
        .join(" · "),
      repos: config.repos,
      updatedAt,
    };
  }

  return {
    connected: true,
    status: "active",
    detail: null,
    repos: config.repos,
    updatedAt,
  };
}
