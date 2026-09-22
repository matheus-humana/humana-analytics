import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { ensureDefaultProject } from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export function getVercelAccessToken(): string | null {
  return (
    process.env.WEB_ANALYTICS_TOKEN?.trim() ||
    process.env.VERCEL_ACCESS_TOKEN?.trim() ||
    process.env.VERCEL_API_TOKEN?.trim() ||
    null
  );
}

/**
 * Project that owns the Humana website Web Analytics.
 * Do not use VERCEL_PROJECT_ID on Vercel deployments — that system env
 * points at this app (humana-analytics), not the website.
 */
export function getVercelProjectId(): string | null {
  const dedicated =
    process.env.WEB_ANALYTICS_PROJECT_ID?.trim() ||
    process.env.HUMANA_SITE_VERCEL_PROJECT_ID?.trim() ||
    null;
  if (dedicated) return dedicated;

  // Local/dev only: allow legacy VERCEL_PROJECT_ID when not running on Vercel.
  if (!process.env.VERCEL) {
    return process.env.VERCEL_PROJECT_ID?.trim() || null;
  }

  return null;
}

export function getVercelTeamId(): string | null {
  return (
    process.env.WEB_ANALYTICS_TEAM_ID?.trim() ||
    process.env.VERCEL_TEAM_ID?.trim() ||
    null
  );
}

export function hasVercelCredentials(): boolean {
  return Boolean(getVercelAccessToken() && getVercelProjectId());
}

export async function ensureVercelDataSource() {
  const projectId = getVercelProjectId();

  const existingSources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.provider, "vercel"))
    .limit(1);

  if (existingSources[0]) {
    const source = existingSources[0];
    if (projectId && source.externalId !== projectId) {
      await db
        .update(dataSources)
        .set({
          externalId: projectId,
          status: hasVercelCredentials() ? "active" : source.status,
          updatedAt: new Date(),
        })
        .where(eq(dataSources.id, source.id));

      return {
        ...source,
        externalId: projectId,
        status: hasVercelCredentials() ? ("active" as const) : source.status,
      };
    }

    if (hasVercelCredentials() && source.status !== "active") {
      await db
        .update(dataSources)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(dataSources.id, source.id));
      return { ...source, status: "active" as const };
    }

    return source;
  }

  const project = await ensureDefaultProject();

  const sourceId = newId();
  const [createdSource] = await db
    .insert(dataSources)
    .values({
      id: sourceId,
      projectId: project.id,
      provider: "vercel",
      name: "Vercel Analytics",
      status: hasVercelCredentials() ? "active" : "inactive",
      externalId: projectId,
    })
    .returning();

  return createdSource;
}

export async function getVercelConnectionStatus() {
  const projectId = getVercelProjectId();
  const ready = hasVercelCredentials();

  let source: Awaited<ReturnType<typeof ensureVercelDataSource>> | null = null;
  try {
    if (ready) {
      source = await ensureVercelDataSource();
    } else {
      source =
        (
          await db
            .select()
            .from(dataSources)
            .where(eq(dataSources.provider, "vercel"))
            .limit(1)
        )[0] ?? null;
    }
  } catch {
    // DB optional for env-based status
  }

  if (ready) {
    return {
      connected: true,
      status: source?.status === "active" ? source.status : "active",
      externalId: source?.externalId ?? projectId,
      dataSourceId: source?.id,
      authMode: "api_token" as const,
      teamId: getVercelTeamId(),
    };
  }

  return {
    connected: false,
    status: "not_connected" as const,
    externalId: projectId,
    dataSourceId: source?.id,
    authMode: null,
    teamId: getVercelTeamId(),
  };
}
