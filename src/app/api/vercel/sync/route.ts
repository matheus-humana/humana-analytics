import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/require-user";
import { fetchVercelSyncPreview } from "@/lib/vercel/fetch-report";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const report = await fetchVercelSyncPreview();
    return NextResponse.json({
      ok: true,
      source: "vercel",
      periodLabel: report.periodLabel,
      totals: report.totals,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vercel sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
