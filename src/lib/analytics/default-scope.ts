import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizationMembers, organizations, projects } from "@/lib/db/schema";

/** Stable id used by the migration backfill and by runtime ensure helpers. */
export const DEFAULT_ORGANIZATION_ID = "org_humana";
export const DEFAULT_ORGANIZATION_SLUG = "humana";
export const DEFAULT_PROJECT_SLUG = "humana-website";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export async function ensureDefaultOrganization() {
  const existing = (
    await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, DEFAULT_ORGANIZATION_SLUG))
      .limit(1)
  )[0];

  if (existing) return existing;

  const [created] = await db
    .insert(organizations)
    .values({
      id: DEFAULT_ORGANIZATION_ID,
      name: "Humana",
      slug: DEFAULT_ORGANIZATION_SLUG,
    })
    .onConflictDoNothing({ target: organizations.slug })
    .returning();

  if (created) return created;

  const again = (
    await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, DEFAULT_ORGANIZATION_SLUG))
      .limit(1)
  )[0];

  if (!again) {
    throw new Error("Failed to ensure the Humana organization.");
  }

  return again;
}

export async function ensureOrganizationMembership(userId: string) {
  const organization = await ensureDefaultOrganization();

  const existing = (
    await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organization.id),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1)
  )[0];

  if (existing) {
    return { organization, membership: existing };
  }

  const [created] = await db
    .insert(organizationMembers)
    .values({
      id: newId(),
      organizationId: organization.id,
      userId,
      role: "member",
    })
    .onConflictDoNothing({
      target: [organizationMembers.organizationId, organizationMembers.userId],
    })
    .returning();

  if (created) {
    return { organization, membership: created };
  }

  const membership = (
    await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organization.id),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1)
  )[0];

  if (!membership) {
    throw new Error("Failed to ensure organization membership.");
  }

  return { organization, membership };
}

/**
 * The single website/project tracked today. Scoped to an organization so
 * additional projects can be added without a schema change.
 */
export async function ensureDefaultProject(organizationId?: string) {
  const organization = organizationId
    ? { id: organizationId }
    : await ensureDefaultOrganization();

  const bySlug = (
    await db
      .select()
      .from(projects)
      .where(eq(projects.slug, DEFAULT_PROJECT_SLUG))
      .limit(1)
  )[0];

  if (bySlug) return bySlug;

  const inOrg = (
    await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organization.id))
      .limit(1)
  )[0];

  if (inOrg) return inOrg;

  const [created] = await db
    .insert(projects)
    .values({
      id: newId(),
      organizationId: organization.id,
      name: "Humana Website",
      slug: DEFAULT_PROJECT_SLUG,
    })
    .returning();

  return created;
}
