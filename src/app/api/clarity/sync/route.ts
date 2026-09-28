import { NextResponse } from "next/server";

/**
 * Microsoft Clarity is not a product source. The client remains in
 * src/lib/clarity and src/lib/analytics/clarity-source.ts, and the
 * database tables are unchanged. This route no longer calls the API.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Microsoft Clarity is not used as a traffic source." },
    { status: 410 }
  );
}
