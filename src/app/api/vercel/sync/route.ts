import { NextResponse } from "next/server";

/**
 * Vercel Web Analytics is not a product source. The client remains in
 * src/lib/vercel and src/lib/analytics/vercel-source.ts, and the database
 * tables are unchanged. This route no longer calls the API.
 * CRON_SECRET and the Vercel platform still run the GitHub and SEO crons.
 */
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Vercel Analytics is not used as a traffic source." },
    { status: 410 }
  );
}
