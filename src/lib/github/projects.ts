import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { ensureDefaultOrganization } from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import { dataSources, projects } from "@/lib/db/schema";

import { githubProjectSlug } from "./config";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * A GitHub repository is its own project and data source.
 * It is never attached to the website project.
 */
export async function ensureGithubProject(repo: string) {
  const organization = await ensureDefaultOrganization();
  const slug = githubProjectSlug(repo);

  const existing = (
    await db.select().from(projects).where(eq(projects.slug, slug)).limit(1)
  )[0];

  const project =
    existing ??
    (
      await db
        .insert(projects)
        .values({
          id: newId(),
          organizationId: organization.id,
          name: `GitHub ${repo}`,
          slug,
        })
        .returning()
    )[0];

  if (!project) {
    throw new Error(`Failed to ensure the GitHub project for ${repo}.`);
  }

  const source = (
    await db
      .select()
      .from(dataSources)
      .where(
        and(eq(dataSources.projectId, project.id), eq(dataSources.provider, "github"))
      )
      .limit(1)
  )[0];

  if (!source) {
    await db.insert(dataSources).values({
      id: newId(),
      projectId: project.id,
      provider: "github",
      name: `GitHub ${repo}`,
      status: "inactive",
      externalId: repo,
    });
  } else if (source.externalId !== repo) {
    await db
      .update(dataSources)
      .set({ externalId: repo, updatedAt: new Date() })
      .where(eq(dataSources.id, source.id));
  }

  return project;
}

export async function ensureGithubProjects(repos: string[]) {
  const projectsForRepos = [];
  for (const repo of repos) {
    projectsForRepos.push(await ensureGithubProject(repo));
  }
  return projectsForRepos;
}

export async function markGithubSource(
  projectId: string,
  status: "active" | "inactive" | "error"
) {
  await db
    .update(dataSources)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(dataSources.projectId, projectId), eq(dataSources.provider, "github"))
    );
}
