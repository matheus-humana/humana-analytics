import { NextResponse } from "next/server";

import { getClarityConnectionStatus } from "@/lib/analytics/clarity-source";
import { getGa4ConnectionStatus } from "@/lib/analytics/ga4-source";
import { getVercelConnectionStatus } from "@/lib/analytics/vercel-source";
import { getGithubConnectionStatus } from "@/lib/github/status";
import { getSeoConnectionStatus } from "@/lib/seo/status";
import { requireSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

function publicGa4(
  status: Awaited<ReturnType<typeof getGa4ConnectionStatus>>
) {
  return {
    connected: status.connected,
    status: status.status,
    authMode: status.authMode ?? null,
  };
}

function publicSource(status: { connected: boolean; status: string }) {
  return {
    connected: status.connected,
    status: status.status,
  };
}

export async function GET() {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const [ga4Raw, clarityRaw, vercelRaw, githubRaw, seoRaw] = await Promise.all([
      getGa4ConnectionStatus(),
      getClarityConnectionStatus(),
      getVercelConnectionStatus(),
      getGithubConnectionStatus(),
      getSeoConnectionStatus().catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "SEO status failed";
        const failed = {
          connected: false,
          status: "error" as const,
          detail,
          updatedAt: null,
        };
        return { siteUrl: null, pagespeed: failed, crawl: { ...failed } };
      }),
    ]);

    const ga4 = publicGa4(ga4Raw);
    const clarity = publicSource(clarityRaw);
    const vercel = publicSource(vercelRaw);
    const github = {
      connected: githubRaw.connected,
      status: githubRaw.status,
      detail: githubRaw.detail,
      repos: githubRaw.repos,
    };

    return NextResponse.json({
      ...ga4,
      ga4,
      clarity,
      vercel,
      github,
      seo: {
        siteUrl: seoRaw.siteUrl,
        pagespeed: seoRaw.pagespeed,
        crawl: seoRaw.crawl,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
