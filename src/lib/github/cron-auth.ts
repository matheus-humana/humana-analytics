import { secretsMatch } from "@/lib/ai/analytics-bot";

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on GET. */
export function isGithubCronAuthorized(
  request: Request,
  env: { cronSecret?: string | null; githubCronSecret?: string | null } = {
    cronSecret: process.env.CRON_SECRET,
    githubCronSecret: process.env.GITHUB_CRON_SECRET,
  }
): boolean {
  const provided = bearer(request);
  if (!provided) return false;
  const secrets = [env.cronSecret, env.githubCronSecret]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
  return secrets.some((secret) => secretsMatch(provided, secret));
}
