import { NextResponse } from "next/server";

import { listConversationsForUser } from "@/lib/ai/conversations";
import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const conversations = await listConversationsForUser(authResult.user.id);
    return NextResponse.json({ ok: true, conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list conversations";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status: 500 }
    );
  }
}
