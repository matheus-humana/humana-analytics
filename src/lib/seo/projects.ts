import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { ensureDefaultProject } from "@/lib/analytics/default-scope";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";

function newId(): string {
  return randomBytes(9).toString("base64url");
}

export async function ensureWebsiteProject() {
  return ensureDefaultProject();
}

export async function markSeoSource(
  projectId: string,
  provider: "pagespeed" | "crawl",
  status: "active" | "inactive" | "error",
  externalId: string
) {
  const name = provider === "pagespeed" ? "PageSpeed Insights" : "Site crawl";
  const existing = (
    await db
      .select()
      .from(dataSources)
      .where(and(eq(dataSources.projectId, projectId), eq(dataSources.provider, provider)))
      .limit(1)
  )[0];

  if (!existing) {
    await db.insert(dataSources).values({
      id: newId(),
      projectId,
      provider,
      name,
      status,
      externalId,
    });
    return;
  }

  await db
    .update(dataSources)
    .set({ status, externalId, updatedAt: new Date() })
    .where(eq(dataSources.id, existing.id));
}
