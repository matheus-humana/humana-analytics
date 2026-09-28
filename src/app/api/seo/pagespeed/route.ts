import { after, NextResponse } from "next/server";

import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";
import { isSeoCronAuthorized, pagespeedRequest, pagespeedUrl } from "@/lib/seo/chain";
import { runPagespeedCollection } from "@/lib/seo/collect";
import type { PagespeedStrategy } from "@/lib/seo/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function pagespeed(request: Request) {
  if (!isSeoCronAuthorized(request)) {
    const authResult = await requireSessionUser();
    if (!authResult.user) return authResult.response;
  }

  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? undefined;
  const strategy = readStrategy(url.searchParams.get("strategy"));
  const force = url.searchParams.get("force") === "1";

  after(async () => {
    try {
      const result = await runPagespeedCollection({ page, strategy, force });
      if (result.next && !result.quota) {
        await pagespeedRequest(
          request,
          pagespeedUrl(request, { page: result.next.page, strategy: result.next.strategy })
        );
      }
    } catch (error) {
      console.error("[humana-analytics] pagespeed collect failed", {
        message: error instanceof Error ? redactSensitive(error.message, 200) : "failed",
      });
    }
  });

  return NextResponse.json({
    ok: true,
    accepted: true,
    page: page ?? null,
    strategy: strategy ?? null,
    force,
  });
}

function readStrategy(value: string | null): PagespeedStrategy | undefined {
  if (value === "mobile" || value === "desktop") return value;
  return undefined;
}

export function GET(request: Request) {
  return pagespeed(request);
}

export function POST(request: Request) {
  return pagespeed(request);
}
