import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { githubRepoDays, githubTrafficDays } from "@/lib/db/schema";

import type { GithubSnapshotStore } from "./store";
import type { RepoDayRow, TrafficDayRow } from "./types";

function asReferrers(value: unknown): RepoDayRow["referrers"] {
  return Array.isArray(value) ? (value as RepoDayRow["referrers"]) : [];
}

function asPaths(value: unknown): RepoDayRow["paths"] {
  return Array.isArray(value) ? (value as RepoDayRow["paths"]) : [];
}

function asAssets(value: unknown): RepoDayRow["assets"] {
  return Array.isArray(value) ? (value as RepoDayRow["assets"]) : [];
}

export function createPostgresGithubStore(): GithubSnapshotStore {
  return {
    async upsertTrafficDays(rows) {
      if (rows.length === 0) return;
      await db
        .insert(githubTrafficDays)
        .values(
          rows.map((row) => ({
            repo: row.repo,
            projectId: row.projectId,
            day: row.day,
            views: row.views,
            uniqueViews: row.uniqueViews,
            clones: row.clones,
            uniqueClones: row.uniqueClones,
          }))
        )
        .onConflictDoUpdate({
          target: [githubTrafficDays.repo, githubTrafficDays.day],
          set: {
            projectId: sql`excluded.project_id`,
            views: sql`coalesce(excluded.views, ${githubTrafficDays.views})`,
            uniqueViews: sql`coalesce(excluded.unique_views, ${githubTrafficDays.uniqueViews})`,
            clones: sql`coalesce(excluded.clones, ${githubTrafficDays.clones})`,
            uniqueClones: sql`coalesce(excluded.unique_clones, ${githubTrafficDays.uniqueClones})`,
            collectedAt: new Date(),
          },
        });
    },
    async upsertRepoDay(row) {
      await db
        .insert(githubRepoDays)
        .values({
          repo: row.repo,
          projectId: row.projectId,
          day: row.day,
          stars: row.stars,
          forks: row.forks,
          watchers: row.watchers,
          releaseDownloads: row.releaseDownloads,
          views14d: row.views14d,
          uniqueViews14d: row.uniqueViews14d,
          clones14d: row.clones14d,
          uniqueClones14d: row.uniqueClones14d,
          referrers: row.referrers,
          paths: row.paths,
          assets: row.assets,
        })
        .onConflictDoUpdate({
          target: [githubRepoDays.repo, githubRepoDays.day],
          set: {
            projectId: sql`excluded.project_id`,
            stars: sql`excluded.stars`,
            forks: sql`excluded.forks`,
            watchers: sql`excluded.watchers`,
            releaseDownloads: sql`excluded.release_downloads`,
            views14d: sql`excluded.views_14d`,
            uniqueViews14d: sql`excluded.unique_views_14d`,
            clones14d: sql`excluded.clones_14d`,
            uniqueClones14d: sql`excluded.unique_clones_14d`,
            referrers: sql`excluded.referrers`,
            paths: sql`excluded.paths`,
            assets: sql`excluded.assets`,
            collectedAt: new Date(),
          },
        });
    },
    async listTrafficDays(repo) {
      const rows = await db
        .select()
        .from(githubTrafficDays)
        .where(eq(githubTrafficDays.repo, repo))
        .orderBy(asc(githubTrafficDays.day));
      return rows.map(
        (row): TrafficDayRow => ({
          repo: row.repo,
          projectId: row.projectId,
          day: row.day,
          views: row.views,
          uniqueViews: row.uniqueViews,
          clones: row.clones,
          uniqueClones: row.uniqueClones,
        })
      );
    },
    async listRepoDays(repo) {
      const rows = await db
        .select()
        .from(githubRepoDays)
        .where(eq(githubRepoDays.repo, repo))
        .orderBy(asc(githubRepoDays.day));
      return rows.map(
        (row): RepoDayRow => ({
          repo: row.repo,
          projectId: row.projectId,
          day: row.day,
          stars: row.stars,
          forks: row.forks,
          watchers: row.watchers,
          releaseDownloads: row.releaseDownloads,
          views14d: row.views14d,
          uniqueViews14d: row.uniqueViews14d,
          clones14d: row.clones14d,
          uniqueClones14d: row.uniqueClones14d,
          referrers: asReferrers(row.referrers),
          paths: asPaths(row.paths),
          assets: asAssets(row.assets),
        })
      );
    },
  };
}
