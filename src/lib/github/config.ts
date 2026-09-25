import {
  GITHUB_INVALID_REPO,
  GITHUB_MISSING_REPO,
  GITHUB_MISSING_TOKEN,
} from "./types";

const REPO_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export type GithubConfig =
  | { ok: true; token: string; repos: string[] }
  | { ok: false; detail: string };

export function parseGithubRepoList(
  raw: string | undefined | null
): { ok: true; repos: string[] } | { ok: false; detail: string } {
  const parts = (raw ?? "")
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { ok: false, detail: GITHUB_MISSING_REPO };
  }

  const invalid = parts.filter((part) => !REPO_PATTERN.test(part));
  if (invalid.length > 0) {
    return { ok: false, detail: `${GITHUB_INVALID_REPO}:${invalid[0]}` };
  }

  const repos: string[] = [];
  for (const part of parts) {
    if (!repos.includes(part)) repos.push(part);
  }
  return { ok: true, repos };
}

export function readGithubConfig(env: {
  token?: string | null;
  repo?: string | null;
} = {
  token: process.env.GITHUB_TOKEN,
  repo: process.env.GITHUB_REPO,
}): GithubConfig {
  const token = env.token?.trim() ?? "";
  if (!token) return { ok: false, detail: GITHUB_MISSING_TOKEN };

  const parsed = parseGithubRepoList(env.repo);
  if (!parsed.ok) return parsed;
  return { ok: true, token, repos: parsed.repos };
}

export function hasGithubConfig(): boolean {
  return readGithubConfig().ok;
}

export function githubProjectSlug(repo: string): string {
  const cleaned = repo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `github-${cleaned}`.slice(0, 80);
}
