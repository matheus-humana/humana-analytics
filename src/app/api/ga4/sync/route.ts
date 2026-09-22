import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/require-user";
import { fetchGa4Last7Days } from "@/lib/ga4/fetch-report";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const report = await fetchGa4Last7Days();
    return NextResponse.json({
      ok: true,
      source: "ga4",
      totals: report.totals,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GA4 sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
