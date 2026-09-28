"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

type Ga4ConnectionStatus = {
  connected: boolean;
  status: string;
  authMode?: "service_account" | "oauth" | null;
};

type Ga4SyncResult = {
  ok: boolean;
  error?: string;
  totals?: {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
  };
};

function githubDetailLabel(detail: string | null): string | null {
  if (!detail) return null;
  if (detail === "missing_token") return "GITHUB_TOKEN is not set.";
  if (detail === "missing_repo") return "GITHUB_REPO is not set. Use owner/name.";
  if (detail.startsWith("invalid_repo")) {
    const sample = detail.slice("invalid_repo".length).replace(/^:/, "");
    return sample ? `GITHUB_REPO is invalid (${sample}).` : "GITHUB_REPO is invalid.";
  }
  return detail;
}

type GithubConnectionStatus = {
  connected: boolean;
  status: string;
  detail: string | null;
  repos: string[];
};

type SeoSourceStatus = {
  connected: boolean;
  status: string;
  detail: string | null;
  updatedAt: string | null;
};

type SeoConnectionStatus = {
  siteUrl: string | null;
  pagespeed: SeoSourceStatus;
  crawl: SeoSourceStatus;
};

type Props = {
  initialGa4: Ga4ConnectionStatus;
  initialGithub: GithubConnectionStatus;
  initialSeo: SeoConnectionStatus;
};

export function DataSourcesPanel({
  initialGa4,
  initialGithub,
  initialSeo,
}: Props) {
  const searchParams = useSearchParams();
  const oauthMessage =
    searchParams.get("connected") === "ga4"
      ? "Google Analytics connected successfully."
      : null;
  const oauthError = searchParams.get("error");

  const [ga4, setGa4] = useState<Ga4ConnectionStatus>(initialGa4);
  const [github, setGithub] = useState<GithubConnectionStatus>(initialGithub);
  const [seo, setSeo] = useState<SeoConnectionStatus>(initialSeo);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ga4Syncing, setGa4Syncing] = useState(false);
  const [githubSyncing, setGithubSyncing] = useState(false);
  const [seoSyncing, setSeoSyncing] = useState(false);
  const [ga4Sync, setGa4Sync] = useState<Ga4SyncResult | null>(null);

  const message = localMessage ?? oauthMessage;
  const error = localError ?? oauthError;
  const ga4Connected = Boolean(ga4.connected);
  const githubConnected = Boolean(github.connected);

  async function refreshStatus() {
    const response = await fetch("/api/data-sources/status");
    const data = (await response.json()) as {
      ga4?: Ga4ConnectionStatus;
      github?: GithubConnectionStatus;
      seo?: SeoConnectionStatus;
      error?: string;
      connected?: boolean;
      status?: string;
      authMode?: Ga4ConnectionStatus["authMode"];
    };
    if (!response.ok) {
      setLocalError(data.error ?? "Failed to load connection status");
      return;
    }
    if (data.ga4) setGa4(data.ga4);
    else if (typeof data.connected === "boolean") {
      setGa4({
        connected: data.connected,
        status: data.status ?? "unknown",
        authMode: data.authMode ?? null,
      });
    }
    if (data.github) setGithub(data.github);
    if (data.seo) setSeo(data.seo);
  }

  async function handleGa4Sync() {
    setGa4Syncing(true);
    setLocalError(null);
    setGa4Sync(null);

    try {
      const response = await fetch("/api/ga4/sync", { method: "POST" });
      const data = (await response.json()) as Ga4SyncResult;
      setGa4Sync(data);
      if (!response.ok || !data.ok) {
        setLocalError(data.error ?? "GA4 sync failed");
      } else {
        setLocalMessage("GA4 metrics synced for the last 7 days.");
        await refreshStatus();
      }
    } catch {
      setLocalError("GA4 sync request failed");
    } finally {
      setGa4Syncing(false);
    }
  }

  async function handleSeoCollect() {
    setSeoSyncing(true);
    setLocalError(null);
    setLocalMessage(null);
    try {
      const response = await fetch("/api/seo/collect", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        setLocalError(data.error ?? "SEO collect failed");
      } else {
        setLocalMessage(
          "Crawl stored. PageSpeed continues one page at a time; refresh in a few minutes."
        );
      }
      await refreshStatus();
    } catch {
      setLocalError("SEO collect request failed");
    } finally {
      setSeoSyncing(false);
    }
  }

  async function handleGithubCollect() {
    setGithubSyncing(true);
    setLocalError(null);
    setLocalMessage(null);
    try {
      const response = await fetch("/api/github/collect", { method: "POST" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || data.ok === false) {
        setLocalError(data.error ?? "GitHub collect failed");
      } else {
        setLocalMessage("GitHub snapshot stored.");
      }
      await refreshStatus();
    } catch {
      setLocalError("GitHub collect request failed");
    } finally {
      setGithubSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Data Sources
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          GA4 is the traffic source. GitHub, PageSpeed and the SEO/GEO crawl stay
          connected here. Clarity and Vercel are not used.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm text-accent">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[#cccccc] bg-[#f1f1f1] px-4 py-3 text-sm text-[#151515]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Google Analytics 4
            </h2>
            <p className="mt-1 text-sm text-muted">
              Aquisição, engajamento e conversões.
            </p>
            <p
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${
                ga4Connected
                  ? "bg-accent-soft text-accent"
                  : "bg-[#f1f1f1] text-[#5f5f5f]"
              }`}
            >
              {ga4Connected ? "Connected" : "Not connected"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {ga4.authMode !== "service_account" ? (
              // Full document navigation: this URL starts Google OAuth.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a
                href="/api/auth/google/start"
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[#f1f1f1]"
              >
                {ga4Connected ? "Reconnect" : "Connect"}
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void handleGa4Sync()}
              disabled={!ga4Connected || ga4Syncing}
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ga4Syncing ? "Syncing…" : "Sync metrics"}
            </button>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              GitHub
            </h2>
            <p className="mt-1 text-sm text-muted">
              Views, clones e downloads do repositório. Projeto separado do site.
            </p>
            <p
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${
                githubConnected
                  ? "bg-accent-soft text-accent"
                  : "bg-[#f1f1f1] text-[#5f5f5f]"
              }`}
            >
              {githubConnected ? "Connected" : github.status === "error" ? "Error" : "Not connected"}
            </p>
            {githubDetailLabel(github.detail) ? (
              <p className="mt-2 max-w-xl text-sm text-foreground">
                {githubDetailLabel(github.detail)}
              </p>
            ) : null}
            {github.repos.length > 0 ? (
              <p className="mt-1 text-xs text-muted">{github.repos.join(", ")}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleGithubCollect()}
              disabled={githubSyncing}
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {githubSyncing ? "Collecting…" : "Collect snapshot"}
            </button>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              PageSpeed and crawl
            </h2>
            <p className="mt-1 text-sm text-muted">
              Lighthouse scores, on-page findings, and the GEO checklist for {seo.siteUrl ?? "SITE_URL"}.
            </p>
            <p className="mt-3 text-sm text-foreground">
              PageSpeed · {seo.pagespeed.status}
              {seo.pagespeed.detail ? ` · ${seo.pagespeed.detail}` : ""}
            </p>
            <p className="mt-1 text-sm text-foreground">
              Crawl · {seo.crawl.status}
              {seo.crawl.detail ? ` · ${seo.crawl.detail}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSeoCollect()}
              disabled={seoSyncing}
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {seoSyncing ? "Collecting…" : "Collect now"}
            </button>
          </div>
        </article>
      </div>

      {ga4Sync?.ok && ga4Sync.totals ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <h3 className="font-display text-base font-semibold text-foreground">
            Last 7 days (GA4)
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Active users</p>
              <p className="mt-1 text-xl font-semibold">
                {ga4Sync.totals.activeUsers.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Sessions</p>
              <p className="mt-1 text-xl font-semibold">
                {ga4Sync.totals.sessions.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Page views</p>
              <p className="mt-1 text-xl font-semibold">
                {ga4Sync.totals.screenPageViews.toLocaleString("en-US")}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
