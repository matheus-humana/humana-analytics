import { readFileSync } from "node:fs";
import type { CredentialSource } from "@/lib/env";
import { getCredentialStatus } from "@/lib/env";

export type ServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
  projectId?: string;
  source: CredentialSource;
};

type ServiceAccountJson = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
};

function extractServiceAccount(
  parsed: ServiceAccountJson,
  source: CredentialSource,
): ServiceAccountCredentials {
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GA4 service account JSON must include client_email and private_key.",
    );
  }
  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    projectId: parsed.project_id,
    source,
  };
}

function parseJsonObject(raw: string, label: string): ServiceAccountJson {
  try {
    return JSON.parse(raw) as ServiceAccountJson;
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

export function loadServiceAccount(): ServiceAccountCredentials {
  const status = getCredentialStatus();
  if (!status.configured || !status.source) {
    throw new Error(
      "Missing GA4 credentials. Set GOOGLE_APPLICATION_CREDENTIALS, GA4_SERVICE_ACCOUNT_JSON, or GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY. See docs/GA4.md.",
    );
  }

  if (status.source === "GA4_SERVICE_ACCOUNT_JSON") {
    return extractServiceAccount(
      parseJsonObject(
        process.env.GA4_SERVICE_ACCOUNT_JSON!,
        "GA4_SERVICE_ACCOUNT_JSON",
      ),
      status.source,
    );
  }

  if (status.source === "GOOGLE_APPLICATION_CREDENTIALS") {
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
    try {
      const raw = readFileSync(path, "utf8");
      return extractServiceAccount(
        parseJsonObject(raw, "GOOGLE_APPLICATION_CREDENTIALS"),
        status.source,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("valid JSON")) {
        throw error;
      }
      throw new Error(
        "Could not read GOOGLE_APPLICATION_CREDENTIALS. Check that the file path exists.",
      );
    }
  }

  return {
    clientEmail: process.env.GA4_CLIENT_EMAIL!.trim(),
    privateKey: process.env.GA4_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    projectId: process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
    source: status.source,
  };
}
