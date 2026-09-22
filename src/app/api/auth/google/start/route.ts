import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { buildGoogleAuthorizationUrl } from "@/lib/oauth/google";

const OAUTH_STATE_COOKIE = "ha_google_oauth_state";

export async function GET() {
  try {
    const state = randomBytes(24).toString("base64url");
    const cookieStore = await cookies();

    cookieStore.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });

    const url = buildGoogleAuthorizationUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start Google OAuth";
    return NextResponse.redirect(
      new URL(
        `/data-sources?error=${encodeURIComponent(message)}`,
        process.env.APP_URL ?? "http://localhost:3000"
      )
    );
  }
}
