import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  ensureGa4DataSource,
  upsertGa4Credentials,
} from "@/lib/analytics/ga4-source";
import { encryptSecret } from "@/lib/crypto/token-encryption";
import {
  exchangeCodeForTokens,
  GA4_READONLY_SCOPE,
} from "@/lib/oauth/google";

const OAUTH_STATE_COOKIE = "ha_google_oauth_state";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const redirectWith = (params: Record<string, string>) => {
    const target = new URL("/data-sources", APP_URL);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }
    return NextResponse.redirect(target);
  };

  try {
    if (oauthError) {
      return redirectWith({ error: `Google OAuth error: ${oauthError}` });
    }

    if (!code || !state) {
      return redirectWith({ error: "Missing OAuth code or state" });
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
    cookieStore.delete(OAUTH_STATE_COOKIE);

    if (!expectedState || expectedState !== state) {
      return redirectWith({ error: "Invalid OAuth state" });
    }

    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      return redirectWith({
        error:
          "Google did not return a refresh token. Revoke app access and try again with prompt=consent.",
      });
    }

    const source = await ensureGa4DataSource();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await upsertGa4Credentials({
      dataSourceId: source.id,
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      scope: tokens.scope || GA4_READONLY_SCOPE,
      expiresAt,
    });

    return redirectWith({ connected: "ga4" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "OAuth callback failed";
    const safe = message.replace(/ya29\.[^\s]+/g, "[redacted]");
    return redirectWith({ error: safe });
  }
}
