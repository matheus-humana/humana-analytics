import { NextResponse } from "next/server";
import { getPersistedMetrics } from "@/lib/analytics/queries";
import { getDb } from "@/lib/db";
import { publicErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = url.searchParams.get("days");
  const startDate = url.searchParams.get("start") ?? undefined;
  const endDate = url.searchParams.get("end") ?? undefined;

  try {
    const metrics = await getPersistedMetrics(getDb(), {
      days: days ? Number(days) : undefined,
      startDate,
      endDate,
    });
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error) },
      { status: 500 },
    );
  }
}
