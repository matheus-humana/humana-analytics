import { readSeoConfig, NO_SNAPSHOT } from "./config";
import { ensureWebsiteProject } from "./projects";
import { createPostgresSeoStore } from "./postgres-store";
import type { SeoSnapshotStore } from "./store";

export type SeoSourceStatus = {
  connected: boolean;
  status: "active" | "error" | "not_connected";
  detail: string | null;
  updatedAt: string | null;
};

export async function getSeoConnectionStatus(options?: {
  store?: SeoSnapshotStore;
}): Promise<{
  siteUrl: string | null;
  pagespeed: SeoSourceStatus;
  crawl: SeoSourceStatus;
}> {
  const config = readSeoConfig();
  if (!config.ok) {
    const empty: SeoSourceStatus = {
      connected: false,
      status: "not_connected",
      detail: config.detail,
      updatedAt: null,
    };
    return { siteUrl: null, pagespeed: empty, crawl: { ...empty } };
  }

  const store = options?.store ?? createPostgresSeoStore();
  const project = await ensureWebsiteProject();
  const [pagespeed, crawl] = await Promise.all([
    store.latestRun(project.id, "pagespeed"),
    store.latestRun(project.id, "crawl"),
  ]);

  return {
    siteUrl: config.config.siteUrl,
    pagespeed: fromRun(pagespeed),
    crawl: fromRun(crawl),
  };
}

function fromRun(
  run: { ok: boolean; detail: string | null; finishedAt: string } | null
): SeoSourceStatus {
  if (!run) {
    return {
      connected: false,
      status: "not_connected",
      detail: NO_SNAPSHOT,
      updatedAt: null,
    };
  }
  if (!run.ok) {
    return {
      connected: false,
      status: "error",
      detail: run.detail,
      updatedAt: run.finishedAt,
    };
  }
  return {
    connected: true,
    status: "active",
    detail: run.detail,
    updatedAt: run.finishedAt,
  };
}
