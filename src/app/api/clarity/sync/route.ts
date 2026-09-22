import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/require-user";
import { fetchClaritySyncPreview } from "@/lib/clarity/fetch-report";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const report = await fetchClaritySyncPreview();
    return NextResponse.json({
      ok: true,
      source: "clarity",
      periodLabel: report.periodLabel,
      totals: report.totals,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clarity sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
