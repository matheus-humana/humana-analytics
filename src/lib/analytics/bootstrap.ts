import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  dataSourceCredentials,
  dataSources,
  organizations,
  projects,
} from "@/lib/db/schema";
import { getBootstrapNames, getCredentialStatus } from "@/lib/env";
import { loadServiceAccount } from "./ga4/credentials";

export type AnalyticsContext = {
  organizationId: string;
  projectId: string;
  dataSourceId: string;
  propertyId: string;
};

export async function ensureGa4Context(
  db: Database,
  propertyId: string,
): Promise<AnalyticsContext> {
  const { organizationName, projectName } = getBootstrapNames();

  let [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, organizationName))
    .limit(1);

  if (!organization) {
    [organization] = await db
      .insert(organizations)
      .values({ name: organizationName })
      .returning();
  }

  let [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.organizationId, organization.id),
        eq(projects.name, projectName),
      ),
    )
    .limit(1);

  if (!project) {
    [project] = await db
      .insert(projects)
      .values({
        organizationId: organization.id,
        name: projectName,
      })
      .returning();
  }

  let [dataSource] = await db
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.projectId, project.id),
        eq(dataSources.provider, "google_analytics"),
        eq(dataSources.externalId, propertyId),
      ),
    )
    .limit(1);

  if (!dataSource) {
    [dataSource] = await db
      .insert(dataSources)
      .values({
        projectId: project.id,
        provider: "google_analytics",
        name: "Google Analytics 4",
        externalId: propertyId,
        status: "pending",
      })
      .returning();
  }

  const credentialStatus = getCredentialStatus();
  let principal: string | null = null;
  try {
    principal = loadServiceAccount().clientEmail;
  } catch {
    principal = null;
  }

  const [existingCredential] = await db
    .select()
    .from(dataSourceCredentials)
    .where(eq(dataSourceCredentials.dataSourceId, dataSource.id))
    .limit(1);

  const credentialValues = {
    authType: "service_account",
    configRef: credentialStatus.source
      ? `env:${credentialStatus.source}`
      : "env:unconfigured",
    principal,
    updatedAt: new Date(),
  };

  if (existingCredential) {
    await db
      .update(dataSourceCredentials)
      .set(credentialValues)
      .where(eq(dataSourceCredentials.id, existingCredential.id));
  } else {
    await db.insert(dataSourceCredentials).values({
      dataSourceId: dataSource.id,
      ...credentialValues,
    });
  }

  return {
    organizationId: organization.id,
    projectId: project.id,
    dataSourceId: dataSource.id,
    propertyId,
  };
}

export async function markDataSourceStatus(
  db: Database,
  dataSourceId: string,
  status: "pending" | "connected" | "error",
) {
  await db
    .update(dataSources)
    .set({ status, updatedAt: new Date() })
    .where(eq(dataSources.id, dataSourceId));
}
