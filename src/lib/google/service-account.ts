import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const GA4_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccountKey = {
  type?: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function loadServiceAccountKey(): ServiceAccountKey | null {
  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    return JSON.parse(inlineJson) as ServiceAccountKey;
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim();
  if (!keyPath) {
    return null;
  }

  const absolutePath = resolve(process.cwd(), keyPath);
  const raw = readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as ServiceAccountKey;
}

export function hasGoogleServiceAccount(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim() ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
  );
}

export function getServiceAccountEmail(): string | null {
  try {
    return loadServiceAccountKey()?.client_email ?? null;
  } catch {
    return null;
  }
}

function signJwt(key: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope: GA4_READONLY_SCOPE,
    aud: key.token_uri || TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();

  const signature = signer.sign(
    createPrivateKey(key.private_key),
    "base64"
  );
  const encodedSignature = signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${unsigned}.${encodedSignature}`;
}

export async function getServiceAccountAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const key = loadServiceAccountKey();
  if (!key?.client_email || !key.private_key) {
    throw new Error(
      "Service account key missing. Set GOOGLE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_SERVICE_ACCOUNT_JSON."
    );
  }

  const assertion = signJwt(key);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Service account token exchange failed (${response.status}): ${detail}`
    );
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + payload.expires_in * 1000,
  };

  return payload.access_token;
}
