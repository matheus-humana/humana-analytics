import { NextResponse } from "next/server";

import { chatModelOptions } from "@/lib/ai/engine";
import { requireSessionUser } from "@/lib/auth/require-user";
import { readWebSearchConfig } from "@/lib/web/search";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;
  const web = readWebSearchConfig();
  return NextResponse.json({
    ok: true,
    ...chatModelOptions(),
    webSearch: web.ok ? web.mode : "off",
  });
}
