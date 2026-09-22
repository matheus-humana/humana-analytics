import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  dataSourceCredentials,
  dataSources,
  projects,
} from "@/lib/db/schema";
import {
  getServiceAccountEmail,
  hasGoogleServiceAccount,
} from "@/lib/google/service-account";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Ensures a demo project + GA4 data source exist for OAuth connections.
 * Uses GA4_PROPERTY_ID from env when available.
 */
export async function ensureGa4DataSource() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() || null;

  const existingSources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.provider, "ga4"))
    .limit(1);

  if (existingSources[0]) {
    const source = existingSources[0];
    if (propertyId && source.externalId !== propertyId) {
      await db
        .update(dataSources)
        .set({
          externalId: propertyId,
          updatedAt: new Date(),
        })
        .where(eq(dataSources.id, source.id));

      return { ...source, externalId: propertyId };
    }

    return source;
  }

  let project = (
    await db.select().from(projects).limit(1)
  )[0];

  if (!project) {
    const projectId = newId();
    const [created] = await db
      .insert(projects)
      .values({
        id: projectId,
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
      provider: "ga4",
      name: "Google Analytics 4",
      status: "inactive",
      externalId: propertyId,
    })
    .returning();

  return createdSource;
}

export async function upsertGa4Credentials(input: {
  dataSourceId: string;
  refreshTokenEncrypted: string;
  scope: string;
  expiresAt: Date | null;
}) {
  const existing = await db
    .select()
    .from(dataSourceCredentials)
    .where(eq(dataSourceCredentials.dataSourceId, input.dataSourceId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(dataSourceCredentials)
      .set({
        refreshTokenEncrypted: input.refreshTokenEncrypted,
        scope: input.scope,
        expiresAt: input.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(dataSourceCredentials.id, existing[0].id));
  } else {
    await db.insert(dataSourceCredentials).values({
      id: newId(),
      dataSourceId: input.dataSourceId,
      provider: "ga4",
      refreshTokenEncrypted: input.refreshTokenEncrypted,
      scope: input.scope,
      expiresAt: input.expiresAt,
    });
  }

  await db
    .update(dataSources)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(dataSources.id, input.dataSourceId));
}

export async function getGa4ConnectionStatus() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() || null;
  const serviceAccountReady = hasGoogleServiceAccount();
  const serviceAccountEmail = serviceAccountReady
    ? getServiceAccountEmail()
    : null;

  const source = (
    await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.provider, "ga4"))
      .limit(1)
  )[0];

  if (serviceAccountReady && propertyId) {
    return {
      connected: true,
      status: source?.status === "active" ? source.status : "active",
      externalId: source?.externalId ?? propertyId,
      dataSourceId: source?.id,
      authMode: "service_account" as const,
      serviceAccountEmail,
    };
  }

  if (!source) {
    return {
      connected: false,
      status: "not_connected" as const,
      externalId: propertyId,
      authMode: null,
      serviceAccountEmail: null,
    };
  }

  const credential = (
    await db
      .select({ id: dataSourceCredentials.id })
      .from(dataSourceCredentials)
      .where(eq(dataSourceCredentials.dataSourceId, source.id))
      .limit(1)
  )[0];

  const oauthConnected = Boolean(credential) && source.status === "active";

  return {
    connected: oauthConnected,
    status: source.status,
    externalId: source.externalId,
    dataSourceId: source.id,
    authMode: oauthConnected ? ("oauth" as const) : null,
    serviceAccountEmail: null,
  };
}
