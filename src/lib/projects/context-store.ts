import { randomBytes } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import type {
  ContextCompetitorInput,
  ContextDocumentInput,
  ContextProfileInput,
  StoredContext,
} from "@/lib/ai/context-input";
import { ensureOrganizationMembership } from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import {
  organizationMembers,
  projectCompetitors,
  projectDocuments,
  projectProfiles,
  projects,
} from "@/lib/db/schema";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export async function requireProjectAccess(userId: string, projectId: string) {
  const { organization } = await ensureOrganizationMembership(userId);
  const project = (
    await db
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        name: projects.name,
      })
      .from(projects)
      .innerJoin(
        organizationMembers,
        eq(organizationMembers.organizationId, projects.organizationId)
      )
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organization.id),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1)
  )[0];

  return project ?? null;
}

export async function loadProjectContext(projectId: string): Promise<StoredContext> {
  const profile = (
    await db
      .select()
      .from(projectProfiles)
      .where(eq(projectProfiles.projectId, projectId))
      .limit(1)
  )[0];

  const competitors = await db
    .select()
    .from(projectCompetitors)
    .where(eq(projectCompetitors.projectId, projectId))
    .orderBy(asc(projectCompetitors.createdAt));

  const documents = await db
    .select()
    .from(projectDocuments)
    .where(eq(projectDocuments.projectId, projectId))
    .orderBy(asc(projectDocuments.createdAt));

  return {
    profile: profile
      ? {
          siteUrl: profile.siteUrl,
          languages: profile.languages,
          audience: profile.audience,
          positioning: profile.positioning,
          goals: profile.goals,
        }
      : null,
    competitors: competitors.map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      notes: row.notes,
    })),
    documents: documents.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      url: row.url,
      body: row.body,
      confidential: row.confidential,
    })),
  };
}

export async function saveProjectProfile(
  projectId: string,
  userId: string,
  value: ContextProfileInput
) {
  await db
    .insert(projectProfiles)
    .values({
      projectId,
      siteUrl: value.siteUrl,
      languages: value.languages,
      audience: value.audience,
      positioning: value.positioning,
      goals: value.goals,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: projectProfiles.projectId,
      set: {
        siteUrl: value.siteUrl,
        languages: value.languages,
        audience: value.audience,
        positioning: value.positioning,
        goals: value.goals,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
}

export async function addCompetitor(
  projectId: string,
  userId: string,
  value: ContextCompetitorInput
) {
  const id = newId();
  await db.insert(projectCompetitors).values({
    id,
    projectId,
    name: value.name,
    domain: value.domain,
    notes: value.notes,
    updatedBy: userId,
  });
  return id;
}

export async function updateCompetitor(
  projectId: string,
  competitorId: string,
  userId: string,
  value: ContextCompetitorInput
) {
  const updated = await db
    .update(projectCompetitors)
    .set({
      name: value.name,
      domain: value.domain,
      notes: value.notes,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(
      and(eq(projectCompetitors.id, competitorId), eq(projectCompetitors.projectId, projectId))
    )
    .returning({ id: projectCompetitors.id });
  return updated.length > 0;
}

export async function deleteCompetitor(projectId: string, competitorId: string) {
  const deleted = await db
    .delete(projectCompetitors)
    .where(
      and(eq(projectCompetitors.id, competitorId), eq(projectCompetitors.projectId, projectId))
    )
    .returning({ id: projectCompetitors.id });
  return deleted.length > 0;
}

export async function addDocument(
  projectId: string,
  userId: string,
  value: ContextDocumentInput
) {
  const id = newId();
  await db.insert(projectDocuments).values({
    id,
    projectId,
    title: value.title,
    kind: value.kind,
    url: value.url,
    body: value.body,
    confidential: value.confidential,
    updatedBy: userId,
  });
  return id;
}

export async function updateDocument(
  projectId: string,
  documentId: string,
  userId: string,
  value: ContextDocumentInput
) {
  const updated = await db
    .update(projectDocuments)
    .set({
      title: value.title,
      kind: value.kind,
      url: value.url,
      body: value.body,
      confidential: value.confidential,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(projectDocuments.id, documentId), eq(projectDocuments.projectId, projectId)))
    .returning({ id: projectDocuments.id });
  return updated.length > 0;
}

export async function deleteDocument(projectId: string, documentId: string) {
  const deleted = await db
    .delete(projectDocuments)
    .where(and(eq(projectDocuments.id, documentId), eq(projectDocuments.projectId, projectId)))
    .returning({ id: projectDocuments.id });
  return deleted.length > 0;
}
