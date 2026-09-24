import { NextResponse } from "next/server";

import { getOwnedConversation } from "@/lib/ai/conversations";
import { redactSensitive } from "@/lib/ai/redact";
import { requireSessionUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireSessionUser();
  if (!authResult.user) return authResult.response;

  try {
    const { id } = await context.params;
    const conversation = await getOwnedConversation(authResult.user.id, id);
    if (!conversation) {
      return NextResponse.json(
        { ok: false, error: "Conversa não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, conversation },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversation";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status: 500 }
    );
  }
}
