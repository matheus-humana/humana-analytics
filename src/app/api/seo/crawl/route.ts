import { NextResponse } from "next/server";

import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";
import { isSeoCronAuthorized } from "@/lib/seo/chain";
import { runCrawlCollection } from "@/lib/seo/collect";
import { INVALID_SITE_URL, MISSING_SITE_URL } from "@/lib/seo/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function crawl(request: Request) {
  if (!isSeoCronAuthorized(request)) {
    const authResult = await requireSessionUser();
    if (!authResult.user) return authResult.response;
  }

  try {
    const result = await runCrawlCollection();
    if (!result.ok && isConfigError(result.error)) {
      return NextResponse.json(result, { status: 400 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { ...result, error: result.error ? redactSensitive(result.error, 400) : result.error },
        { status: 502 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl failed";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message, 400) },
      { status: 500 }
    );
  }
}

function isConfigError(error: string | undefined): boolean {
  return error === MISSING_SITE_URL || error === INVALID_SITE_URL;
}

export function GET(request: Request) {
  return crawl(request);
}

export function POST(request: Request) {
  return crawl(request);
}
