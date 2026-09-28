import { NextResponse } from "next/server";

/**
 * Microsoft Clarity is not a product source. The client was removed.
 * The provider value, migrations, and any historical rows stay in the
 * database. This route no longer calls the API.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Microsoft Clarity is not used as a traffic source." },
    { status: 410 }
  );
}
