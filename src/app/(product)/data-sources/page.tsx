import { Suspense } from "react";

import { getClarityConnectionStatus } from "@/lib/analytics/clarity-source";
import { getGa4ConnectionStatus } from "@/lib/analytics/ga4-source";
import { getVercelConnectionStatus } from "@/lib/analytics/vercel-source";
import { getGithubConnectionStatus } from "@/lib/github/status";
import { getSeoConnectionStatus } from "@/lib/seo/status";
import { DataSourcesPanel } from "@/components/data-sources/data-sources-panel";

function publicGa4Status(
  status: Awaited<ReturnType<typeof getGa4ConnectionStatus>>
) {
  return {
    connected: status.connected,
    status: status.status,
    authMode: status.authMode ?? null,
  };
}

function publicSourceStatus(status: {
  connected: boolean;
  status: string;
}) {
  return {
    connected: status.connected,
    status: status.status,
  };
}

export default async function DataSourcesPage() {
  let initialGa4 = {
    connected: false,
    status: "not_connected",
    authMode: null as "service_account" | "oauth" | null,
  };

  let initialClarity = {
    connected: false,
    status: "not_connected",
  };

  let initialVercel = {
    connected: false,
    status: "not_connected",
  };

  let initialGithub = {
    connected: false,
    status: "not_connected",
    detail: "missing_token" as string | null,
    repos: [] as string[],
  };

  let initialSeo = {
    siteUrl: null as string | null,
    pagespeed: {
      connected: false,
      status: "not_connected",
      detail: "missing_site_url" as string | null,
      updatedAt: null as string | null,
    },
    crawl: {
      connected: false,
      status: "not_connected",
      detail: "missing_site_url" as string | null,
      updatedAt: null as string | null,
    },
  };

  try {
    initialGa4 = publicGa4Status(await getGa4ConnectionStatus());
  } catch {
    // Keep disconnected fallback if DB is unreachable during render.
  }

  try {
    initialClarity = publicSourceStatus(await getClarityConnectionStatus());
  } catch {
    const token = process.env.CLARITY_API_TOKEN?.trim();
    const projectId = process.env.CLARITY_PROJECT_ID?.trim();
    if (token && projectId) {
      initialClarity = { connected: true, status: "active" };
    }
  }

  try {
    initialVercel = publicSourceStatus(await getVercelConnectionStatus());
  } catch {
    const token =
      process.env.WEB_ANALYTICS_TOKEN?.trim() ||
      process.env.VERCEL_ACCESS_TOKEN?.trim() ||
      process.env.VERCEL_API_TOKEN?.trim();
    const projectId =
      process.env.WEB_ANALYTICS_PROJECT_ID?.trim() ||
      process.env.HUMANA_SITE_VERCEL_PROJECT_ID?.trim() ||
      (!process.env.VERCEL
        ? process.env.VERCEL_PROJECT_ID?.trim()
        : undefined);
    if (token && projectId) {
      initialVercel = { connected: true, status: "active" };
    }
  }

  try {
    const github = await getGithubConnectionStatus();
    initialGithub = {
      connected: github.connected,
      status: github.status,
      detail: github.detail,
      repos: github.repos,
    };
  } catch (error) {
    initialGithub = {
      connected: false,
      status: "error",
      detail: error instanceof Error ? error.message : "GitHub status failed",
      repos: [],
    };
  }

  try {
    initialSeo = await getSeoConnectionStatus();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "SEO status failed";
    initialSeo = {
      siteUrl: null,
      pagespeed: { connected: false, status: "error", detail, updatedAt: null },
      crawl: { connected: false, status: "error", detail, updatedAt: null },
    };
  }

  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted">Loading data sources…</p>
      }
    >
      <DataSourcesPanel
        initialGa4={initialGa4}
        initialClarity={initialClarity}
        initialVercel={initialVercel}
        initialGithub={initialGithub}
        initialSeo={initialSeo}
      />
    </Suspense>
  );
}
