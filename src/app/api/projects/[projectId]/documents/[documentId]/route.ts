import { NextResponse } from "next/server";

import { parseDocumentInput } from "@/lib/ai/context-input";
import { redactSensitive } from "@/lib/ai/redact";
import {
  deleteDocument,
  loadProjectContext,
  updateDocument,
} from "@/lib/projects/context-store";
import { requireMemberProject } from "@/lib/projects/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string; documentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId, documentId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const parsed = parseDocumentInput(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const updated = await updateDocument(
      access.project.id,
      documentId,
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
  const { projectId, documentId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const deleted = await deleteDocument(access.project.id, documentId);
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
