import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/require-user";

import { requireProjectAccess } from "./context-store";

export async function requireMemberProject(projectId: string) {
  const authResult = await requireSessionUser();
  if (!authResult.user) {
    return { ok: false as const, response: authResult.response };
  }

  const project = await requireProjectAccess(authResult.user.id, projectId);
  if (!project) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "projectUnavailable" },
        { status: 404 }
      ),
    };
  }

  return { ok: true as const, user: authResult.user, project };
}
