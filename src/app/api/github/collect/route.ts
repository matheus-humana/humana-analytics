import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/auth/require-user";
import { redactSensitive } from "@/lib/ai/redact";
import { isGithubCronAuthorized } from "@/lib/github/cron-auth";
import { runGithubCollection } from "@/lib/github/collect";
import {
  GITHUB_INVALID_REPO,
  GITHUB_MISSING_REPO,
  GITHUB_MISSING_TOKEN,
} from "@/lib/github/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function collect(request: Request) {
  if (!isGithubCronAuthorized(request)) {
    const authResult = await requireSessionUser();
    if (!authResult.user) return authResult.response;
  }

  try {
    const result = await runGithubCollection();
    if (!result.ok && isConfigError(result.error)) {
      return NextResponse.json(result, { status: 400 });
    }
    if (!result.ok) {
      return NextResponse.json(
        {
          ...result,
          error: result.error ? redactSensitive(result.error, 500) : result.error,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub collect failed";
    return NextResponse.json(
      { ok: false, error: redactSensitive(message, 500), results: [] },
      { status: 500 }
    );
  }
}

function isConfigError(error: string | undefined): boolean {
  if (!error) return false;
  return (
    error === GITHUB_MISSING_TOKEN ||
    error === GITHUB_MISSING_REPO ||
    error.startsWith(GITHUB_INVALID_REPO)
  );
}

export function GET(request: Request) {
  return collect(request);
}

export function POST(request: Request) {
  return collect(request);
}
