import { NextResponse } from "next/server";

import { parseProfileInput } from "@/lib/ai/context-input";
import { redactSensitive } from "@/lib/ai/redact";
import { loadProjectContext, saveProjectProfile } from "@/lib/projects/context-store";
import { requireMemberProject } from "@/lib/projects/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const stored = await loadProjectContext(access.project.id);
    return NextResponse.json(
      { ok: true, context: stored },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "contextSaveFailed";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const parsed = parseProfileInput(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    await saveProjectProfile(access.project.id, access.user.id, parsed.value);
    const stored = await loadProjectContext(access.project.id);
    return NextResponse.json({ ok: true, context: stored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "contextSaveFailed";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message) },
      { status: 500 }
    );
  }
}
