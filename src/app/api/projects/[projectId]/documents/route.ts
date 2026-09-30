import { NextResponse } from "next/server";

import { parseDocumentInput } from "@/lib/ai/context-input";
import { redactSensitive } from "@/lib/ai/redact";
import { addDocument, loadProjectContext } from "@/lib/projects/context-store";
import { requireMemberProject } from "@/lib/projects/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const access = await requireMemberProject(projectId);
  if (!access.ok) return access.response;

  try {
    const parsed = parseDocumentInput(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    await addDocument(access.project.id, access.user.id, parsed.value);
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
