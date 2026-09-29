import { NextResponse } from "next/server";

import { parseCompetitorInput } from "@/lib/ai/context-input";
import { redactSensitive } from "@/lib/ai/redact";
import {
  deleteCompetitor,
  loadProjectContext,
  updateCompetitor,
} from "@/lib/projects/context-store";
import { requireMemberProject } from "@/lib/projects/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string; competitorId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId, competitorId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const parsed = parseCompetitorInput(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const updated = await updateCompetitor(
      access.project.id,
      competitorId,
      access.user.id,
      parsed.value
    );
    if (!updated) {
      return NextResponse.json({ ok: false, error: "contextInvalid" }, { status: 404 });
    }
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

export async function DELETE(_request: Request, context: RouteContext) {
  const { projectId, competitorId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const deleted = await deleteCompetitor(access.project.id, competitorId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "contextInvalid" }, { status: 404 });
    }
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
