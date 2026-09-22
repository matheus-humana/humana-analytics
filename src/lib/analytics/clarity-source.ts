import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { ensureDefaultProject } from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export function getClarityProjectId(): string | null {
  return process.env.CLARITY_PROJECT_ID?.trim() || null;
}

export function getClarityApiToken(): string | null {
  return process.env.CLARITY_API_TOKEN?.trim() || null;
}

export function hasClarityCredentials(): boolean {
  return Boolean(getClarityApiToken() && getClarityProjectId());
}

/**
 * Ensures a demo project + Clarity data source row exist when env is configured.
 */
export async function ensureClarityDataSource() {
  const projectId = getClarityProjectId();

  const existingSources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.provider, "clarity"))
    .limit(1);

  if (existingSources[0]) {
    const source = existingSources[0];
    if (projectId && source.externalId !== projectId) {
      await db
        .update(dataSources)
        .set({
          externalId: projectId,
          status: hasClarityCredentials() ? "active" : source.status,
          updatedAt: new Date(),
        })
        .where(eq(dataSources.id, source.id));

      return {
        ...source,
        externalId: projectId,
        status: hasClarityCredentials() ? ("active" as const) : source.status,
      };
    }

    if (hasClarityCredentials() && source.status !== "active") {
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
      provider: "clarity",
      name: "Microsoft Clarity",
      status: hasClarityCredentials() ? "active" : "inactive",
      externalId: projectId,
    })
    .returning();

  return createdSource;
}

export async function getClarityConnectionStatus() {
  const projectId = getClarityProjectId();
  const ready = hasClarityCredentials();

  let source: Awaited<ReturnType<typeof ensureClarityDataSource>> | null = null;
  try {
    if (ready) {
      source = await ensureClarityDataSource();
    } else {
      source =
        (
          await db
            .select()
            .from(dataSources)
            .where(eq(dataSources.provider, "clarity"))
            .limit(1)
        )[0] ?? null;
    }
  } catch {
    // DB may be unreachable during render — env alone can still show connected.
  }

  if (ready) {
    return {
      connected: true,
      status: source?.status === "active" ? source.status : "active",
      externalId: source?.externalId ?? projectId,
      dataSourceId: source?.id,
      authMode: "api_token" as const,
    };
  }

  return {
    connected: false,
    status: "not_connected" as const,
    externalId: projectId,
    dataSourceId: source?.id,
    authMode: null,
  };
}
