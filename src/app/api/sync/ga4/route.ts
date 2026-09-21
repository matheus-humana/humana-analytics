import { NextResponse } from "next/server";
import { syncGa4Reports } from "@/lib/analytics/collector";
import { isSyncAuthorized } from "@/lib/analytics/sync-auth";
import { allowFixtureSync, getSyncSecret } from "@/lib/env";
import { publicErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

type SyncBody = {
  days?: number;
  startDate?: string;
  endDate?: string;
  fixture?: boolean;
};

export async function POST(request: Request) {
  if (!isSyncAuthorized(request, getSyncSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SyncBody = {};
  if (request.headers.get("content-type")?.includes("application/json")) {
    body = (await request.json()) as SyncBody;
  }

  if (body.fixture && !allowFixtureSync()) {
    return NextResponse.json(
      {
        error:
          "Fixture sync is disabled. Set ALLOW_GA4_FIXTURE=true to enable it on this endpoint.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await syncGa4Reports({
      days: body.days,
      startDate: body.startDate,
      endDate: body.endDate,
      fixture: body.fixture,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error) },
      { status: 500 },
    );
  }
}
