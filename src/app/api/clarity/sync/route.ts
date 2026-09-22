import { NextResponse } from "next/server";

import { fetchClaritySyncPreview } from "@/lib/clarity/fetch-report";

export async function POST() {
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
