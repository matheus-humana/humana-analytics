import { NextResponse } from "next/server";

import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { requireSessionUser } from "@/lib/auth/require-user";
import { loadGa4DashboardSnapshot } from "@/lib/ga4/dashboard-cache";
import { workspaceCopy } from "@/lib/i18n/workspace-copy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  const period = resolveAnalyticsPeriod(new URL(request.url).searchParams.get("period"));

  try {
    const data = await loadGa4DashboardSnapshot(period.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : workspaceCopy["pt-BR"].ga4LoadFailed;
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
