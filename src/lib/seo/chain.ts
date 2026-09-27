import { isGithubCronAuthorized } from "@/lib/github/cron-auth";

export function isSeoCronAuthorized(request: Request): boolean {
  return isGithubCronAuthorized(request);
}

export function pagespeedRequest(request: Request, target: URL): Promise<void> {
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  return fetch(target, { method: "POST", headers, redirect: "manual" })
    .then(() => undefined)
    .catch(() => undefined);
}

export function pagespeedUrl(
  request: Request,
  job?: { page?: string; strategy?: string; force?: boolean }
): URL {
  const next = new URL(request.url);
  next.pathname = "/api/seo/pagespeed";
  next.search = "";
  if (job?.page) next.searchParams.set("page", job.page);
  if (job?.strategy) next.searchParams.set("strategy", job.strategy);
  if (job?.force) next.searchParams.set("force", "1");
  return next;
}
