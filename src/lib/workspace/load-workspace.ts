import { asc, eq } from "drizzle-orm";

import { listRecentChatSignals } from "@/lib/ai/conversations";
import { ensureDefaultOrganization, ensureDefaultProject } from "@/lib/analytics/default-scope";
import { getGa4ConnectionStatus } from "@/lib/analytics/ga4-source";
import { readGithubConfig } from "@/lib/github/config";
import { ensureGithubProjects } from "@/lib/github/projects";
import { getGithubConnectionStatus } from "@/lib/github/status";
import { getSeoConnectionStatus } from "@/lib/seo/status";
import { db } from "@/lib/db";
import { dataSources, projects } from "@/lib/db/schema";
import { hasGoogleServiceAccount } from "@/lib/google/service-account";

import {
  CONNECTION_PROVIDERS,
  type ChatSignal,
  type ConnectionProvider,
  type ConnectionSnapshot,
} from "./status-log";

export type WorkspaceProject = {
  id: string;
  name: string;
  slug: string;
  kind: "project" | "repository";
  /** `owner/name` for repository projects. */
  repo: string | null;
};

const GITHUB_SLUG_PREFIX = "github-";
const GITHUB_NAME_PREFIX = "GitHub ";

function toWorkspaceProject(row: { id: string; name: string; slug: string }): WorkspaceProject {
  const repository = row.slug.startsWith(GITHUB_SLUG_PREFIX);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: repository ? "repository" : "project",
    repo: repository
      ? row.name.startsWith(GITHUB_NAME_PREFIX)
        ? row.name.slice(GITHUB_NAME_PREFIX.length)
        : row.name
      : null,
  };
}

export type WorkspaceModel = {
  projects: WorkspaceProject[];
  currentProjectId: string | null;
  connections: ConnectionSnapshot[];
  chatSignals: ChatSignal[];
};

export async function loadWorkspaceModel(userId: string): Promise<WorkspaceModel> {
  const [projectState, connections, chatSignals] = await Promise.all([
    loadProjects(),
    loadConnections(),
    loadChatSignals(userId),
  ]);

  return {
    projects: projectState.projects,
    currentProjectId: projectState.currentProjectId,
    connections,
    chatSignals,
  };
}

async function loadProjects(): Promise<{
  projects: WorkspaceProject[];
  currentProjectId: string | null;
}> {
  try {
    const organization = await ensureDefaultOrganization();
    const current = await ensureDefaultProject(organization.id);
    const githubConfig = readGithubConfig();
    if (githubConfig.ok) {
      try {
        await ensureGithubProjects(githubConfig.repos);
      } catch {
        // The website project still loads when the GitHub tables are unavailable.
      }
    }
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organization.id))
      .orderBy(asc(projects.name));

    const list = rows.map(toWorkspaceProject);

    if (!list.some((project) => project.id === current.id)) {
      list.unshift(toWorkspaceProject(current));
    }

    return { projects: list, currentProjectId: current.id };
  } catch {
    return { projects: [], currentProjectId: null };
  }
}

async function loadChatSignals(userId: string): Promise<ChatSignal[]> {
  try {
    return await listRecentChatSignals(userId);
  } catch {
    return [];
  }
}

async function loadConnections(): Promise<ConnectionSnapshot[]> {
  const updatedAt = new Map<ConnectionProvider, string>();

  try {
    const rows = await db
      .select({
        provider: dataSources.provider,
        updatedAt: dataSources.updatedAt,
      })
      .from(dataSources);

    for (const row of rows) {
      if (!isConnectionProvider(row.provider)) continue;
      const current = updatedAt.get(row.provider);
      const next = row.updatedAt.toISOString();
      if (!current || next > current) updatedAt.set(row.provider, next);
    }
  } catch {
    // Status can still come from env. A missing timestamp stays blank.
  }

  const [ga4, github, seo] = await Promise.all([
    safeGa4(),
    safeGithub(),
    safeSeo(),
  ]);

  const byProvider: Record<
    ConnectionProvider,
    { connected: boolean; status: string; detail: string | null; updatedAt?: string | null }
  > = {
    ga4,
    github,
    pagespeed: seo.pagespeed,
    crawl: seo.crawl,
  };

  return CONNECTION_PROVIDERS.map((provider) => ({
    provider,
    connected: byProvider[provider].connected,
    status: byProvider[provider].status,
    detail: byProvider[provider].detail,
    updatedAt:
      provider === "github" && github.updatedAt
        ? github.updatedAt
        : provider === "pagespeed" || provider === "crawl"
          ? byProvider[provider].updatedAt ?? null
          : updatedAt.get(provider) ?? null,
  }));
}

function isConnectionProvider(value: string): value is ConnectionProvider {
  return (CONNECTION_PROVIDERS as readonly string[]).includes(value);
}

async function safeGithub(): Promise<{
  connected: boolean;
  status: string;
  detail: string | null;
  updatedAt: string | null;
}> {
  try {
    const status = await getGithubConnectionStatus();
    return {
      connected: status.connected,
      status: status.status,
      detail: status.detail,
      updatedAt: status.updatedAt,
    };
  } catch (error) {
    return {
      connected: false,
      status: "error",
      detail: error instanceof Error ? error.message : "GitHub status failed",
      updatedAt: null,
    };
  }
}

async function safeSeo(): Promise<{
  pagespeed: { connected: boolean; status: string; detail: string | null; updatedAt: string | null };
  crawl: { connected: boolean; status: string; detail: string | null; updatedAt: string | null };
}> {
  try {
    const status = await getSeoConnectionStatus();
    return { pagespeed: status.pagespeed, crawl: status.crawl };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "SEO status failed";
    const failed = { connected: false, status: "error", detail, updatedAt: null };
    return { pagespeed: failed, crawl: { ...failed } };
  }
}

async function safeGa4(): Promise<{ connected: boolean; status: string; detail: string | null }> {
  try {
    const status = await getGa4ConnectionStatus();
    return { connected: status.connected, status: status.status, detail: null };
  } catch {
    const propertyId = process.env.GA4_PROPERTY_ID?.trim();
    if (hasGoogleServiceAccount() && propertyId) {
      return { connected: true, status: "active", detail: null };
    }
    return { connected: false, status: "not_connected", detail: null };
  }
}
