import { and, eq } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { dataSources, projects } from "@/lib/db/schema";
import { getBootstrapNames } from "@/lib/env";

export type AnalyticsContext = {
  projectId: string;
  dataSourceId: string;
  propertyId: string;
};

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

export async function ensureGa4Context(
  db: Database,
  propertyId: string,
): Promise<AnalyticsContext> {
  const { projectName } = getBootstrapNames();
  const slug = slugify(projectName);

  let [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!project) {
    [project] = await db
      .insert(projects)
      .values({
        id: `project-${slug}`,
        name: projectName,
        slug,
      })
      .returning();
  }

  let [dataSource] = await db
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.projectId, project.id),
        eq(dataSources.provider, "ga4"),
        eq(dataSources.externalId, propertyId),
      ),
    )
    .limit(1);

  if (!dataSource) {
    [dataSource] = await db
      .insert(dataSources)
      .values({
        id: `ga4-${propertyId}`,
        projectId: project.id,
        provider: "ga4",
        name: "Google Analytics 4",
        externalId: propertyId,
        status: "inactive",
      })
      .returning();
  }

  return {
    projectId: project.id,
    dataSourceId: dataSource.id,
    propertyId,
  };
}

export async function markDataSourceStatus(
  db: Database,
  dataSourceId: string,
  status: "active" | "inactive" | "error",
) {
  await db
    .update(dataSources)
    .set({ status, updatedAt: new Date() })
    .where(eq(dataSources.id, dataSourceId));
}
