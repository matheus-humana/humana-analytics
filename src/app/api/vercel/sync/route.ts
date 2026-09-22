import { NextResponse } from "next/server";

import { fetchVercelSyncPreview } from "@/lib/vercel/fetch-report";

export async function POST() {
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
