/**
 * Company Google accounts that may open Humana Analytics.
 *
 * `AUTH_ALLOWED_DOMAINS` is a comma-separated list of exact email domains.
 * When the variable is unset or blank, the default is humana.ai and
 * humana-ai.com. An explicit list replaces the default. Tokens that are not
 * domains are dropped; if none remain, nobody can sign in.
 *
 * Matching is the exact domain after @. Subdomains are not included.
 * `hd` (Google Workspace hosted domain) is not required: an alias domain can
 * differ from the workspace primary domain.
 */

export const DEFAULT_ALLOWED_DOMAINS = ["humana.ai", "humana-ai.com"] as const;

const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function parseAllowedDomains(raw: string | undefined | null): string[] {
  if (raw == null || raw.trim() === "") return [...DEFAULT_ALLOWED_DOMAINS];

  const domains: string[] = [];
  for (const part of raw.split(",")) {
    const domain = part.trim().toLowerCase().replace(/^@/, "");
    if (!domain || !DOMAIN_PATTERN.test(domain)) continue;
    if (!domains.includes(domain)) domains.push(domain);
  }
  return domains;
}

export function allowedDomainsFromEnv(
  env: Record<string, string | undefined> = process.env
): string[] {
  return parseAllowedDomains(env.AUTH_ALLOWED_DOMAINS);
}

export function emailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@")) return null;
  const domain = trimmed.slice(at + 1);
  if (!DOMAIN_PATTERN.test(domain)) return null;
  return domain;
}

export function isAllowedCompanyEmail(
  email: string | null | undefined,
  domains: readonly string[] = allowedDomainsFromEnv()
): boolean {
  if (!email) return false;
  const domain = emailDomain(email);
  if (!domain) return false;
  return domains.includes(domain);
}

/** Google's ID token sets `email_verified`. Missing or false is rejected. */
export function isGoogleEmailVerified(
  profile: { email_verified?: unknown } | null | undefined
): boolean {
  const value = profile?.email_verified;
  return value === true || value === "true";
}

export function googleProfileMaySignIn(
  profile: { email?: unknown; email_verified?: unknown } | null | undefined,
  domains: readonly string[] = allowedDomainsFromEnv()
): boolean {
  if (!isGoogleEmailVerified(profile)) return false;
  const email = typeof profile?.email === "string" ? profile.email : null;
  return isAllowedCompanyEmail(email, domains);
}
