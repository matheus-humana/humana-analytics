export type CredentialSource =
  | "GA4_SERVICE_ACCOUNT_JSON"
  | "GOOGLE_APPLICATION_CREDENTIALS"
  | "GA4_CLIENT_EMAIL";

export function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Example: postgresql://postgres:postgres@localhost:5432/humana_analytics",
    );
  }
  return url;
}

export function getGa4PropertyId(): string | undefined {
  const raw = process.env.GA4_PROPERTY_ID?.trim();
  if (!raw) {
    return undefined;
  }
  return raw.replace(/^properties\//, "");
}

export function requireGa4PropertyId(): string {
  const propertyId = getGa4PropertyId();
  if (!propertyId) {
    throw new Error(
      "GA4_PROPERTY_ID is required. Use the numeric ID from GA4 Admin → Property details.",
    );
  }
  return propertyId;
}

export function getCredentialStatus(): {
  configured: boolean;
  source: CredentialSource | null;
} {
  if (process.env.GA4_SERVICE_ACCOUNT_JSON?.trim()) {
    return { configured: true, source: "GA4_SERVICE_ACCOUNT_JSON" };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return { configured: true, source: "GOOGLE_APPLICATION_CREDENTIALS" };
  }
  if (
    process.env.GA4_CLIENT_EMAIL?.trim() &&
    process.env.GA4_PRIVATE_KEY?.trim()
  ) {
    return { configured: true, source: "GA4_CLIENT_EMAIL" };
  }
  return { configured: false, source: null };
}

export function getBootstrapNames() {
  return {
    organizationName: process.env.ORGANIZATION_NAME?.trim() || "Humana AI",
    projectName: process.env.PROJECT_NAME?.trim() || "Humana Website",
  };
}

export function getSyncSecret(): string | undefined {
  return process.env.SYNC_SECRET?.trim() || undefined;
}

export function allowFixtureSync(): boolean {
  return process.env.ALLOW_GA4_FIXTURE === "true";
}
