import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { dataSources, projects } from "@/lib/db/schema";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export function getVercelAccessToken(): string | null {
  return (
    process.env.VERCEL_ACCESS_TOKEN?.trim() ||
    process.env.VERCEL_API_TOKEN?.trim() ||
    null
  );
}

export function getVercelProjectId(): string | null {
  return process.env.VERCEL_PROJECT_ID?.trim() || null;
}

export function getVercelTeamId(): string | null {
  return process.env.VERCEL_TEAM_ID?.trim() || null;
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

  let project = (await db.select().from(projects).limit(1))[0];

  if (!project) {
    const id = newId();
    const [created] = await db
      .insert(projects)
      .values({
        id,
        name: "Humana Website",
        slug: "humana-website",
      })
      .returning();
    project = created;
  }

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
