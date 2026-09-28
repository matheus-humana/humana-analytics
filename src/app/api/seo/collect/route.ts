import { after, NextResponse } from "next/server";

import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";
import { isSeoCronAuthorized, pagespeedRequest, pagespeedUrl } from "@/lib/seo/chain";
import { runCrawlCollection } from "@/lib/seo/collect";
import { INVALID_SITE_URL, MISSING_SITE_URL } from "@/lib/seo/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function collect(request: Request) {
  if (!isSeoCronAuthorized(request)) {
    const authResult = await requireSessionUser();
    if (!authResult.user) return authResult.response;
  }

  try {
    const crawl = await runCrawlCollection();
    const configError = crawl.error === MISSING_SITE_URL || crawl.error === INVALID_SITE_URL;
    if (!configError) {
      const target = pagespeedUrl(request, { force: true });
      after(() => pagespeedRequest(request, target));
    }
    if (!crawl.ok && configError) {
      return NextResponse.json({ ...crawl, pagespeed: "not_started" }, { status: 400 });
    }
    return NextResponse.json({
      ...crawl,
      error: crawl.error ? redactSensitive(crawl.error, 400) : undefined,
      pagespeed: configError ? "not_started" : "started",
    }, { status: crawl.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SEO collect failed";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message, 400) },
      { status: 500 }
    );
  }
}

export function POST(request: Request) {
  return collect(request);
}

export function GET(request: Request) {
  return collect(request);
}
