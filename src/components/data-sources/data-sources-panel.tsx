"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { formatCount } from "@/lib/i18n/format";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";

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

function githubDetailLabel(
  detail: string | null,
  text: (key: WorkspaceMessageKey) => string
): string | null {
  if (!detail) return null;
  if (detail === "missing_token") return text("githubMissingToken");
  if (detail === "missing_repo") return text("githubMissingRepo");
  if (detail.startsWith("invalid_repo")) {
    const sample = detail.slice("invalid_repo".length).replace(/^:/, "");
    return sample ? `${text("githubInvalidRepo")} (${sample})` : text("githubInvalidRepo");
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
  const { locale } = useLocale();
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const searchParams = useSearchParams();
  const oauthMessage =
    searchParams.get("connected") === "ga4" ? text("sourcesOauthConnected") : null;
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
      setLocalError(data.error ?? text("sourcesStatusFailed"));
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
        setLocalError(data.error ?? text("sourcesGa4SyncFailed"));
      } else {
        setLocalMessage(text("sourcesGa4Synced"));
        await refreshStatus();
      }
    } catch {
      setLocalError(text("sourcesGa4SyncRequestFailed"));
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
        setLocalError(data.error ?? text("sourcesSeoCollectFailed"));
      } else {
        setLocalMessage(text("sourcesSeoStored"));
      }
      await refreshStatus();
    } catch {
      setLocalError(text("sourcesSeoCollectRequestFailed"));
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
        setLocalError(data.error ?? text("sourcesGithubCollectFailed"));
      } else {
        setLocalMessage(text("sourcesGithubStored"));
      }
      await refreshStatus();
    } catch {
      setLocalError(text("sourcesGithubCollectRequestFailed"));
    } finally {
      setGithubSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {text("dataSources")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{text("sourcesIntro")}</p>
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
              {text("sourcesGa4Body")}
            </p>
            <p
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${
                ga4Connected
                  ? "bg-accent-soft text-accent"
                  : "bg-[#f1f1f1] text-[#5f5f5f]"
              }`}
            >
              {ga4Connected ? text("sourcesConnected") : text("sourcesDisconnected")}
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
                {ga4Connected ? text("sourcesReconnect") : text("sourcesConnect")}
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void handleGa4Sync()}
              disabled={!ga4Connected || ga4Syncing}
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {ga4Syncing ? text("sourcesSyncing") : text("sourcesSync")}
            </button>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              GitHub
            </h2>
            <p className="mt-1 text-sm text-muted">
              {text("sourcesGithubBody")}
            </p>
            <p
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${
                githubConnected
                  ? "bg-accent-soft text-accent"
                  : "bg-[#f1f1f1] text-[#5f5f5f]"
              }`}
            >
              {githubConnected
                ? text("sourcesConnected")
                : github.status === "error"
                  ? text("sourcesError")
                  : text("sourcesDisconnected")}
            </p>
            {githubDetailLabel(github.detail, text) ? (
              <p className="mt-2 max-w-xl text-sm text-foreground">
                {githubDetailLabel(github.detail, text)}
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
              {githubSyncing ? text("githubCollecting") : text("sourcesCollectSnapshot")}
            </button>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              {text("sourcesSeoTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {text("sourcesSeoBody")} {seo.siteUrl ?? "SITE_URL"}.
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
              {seoSyncing ? text("seoCollecting") : text("seoCollect")}
            </button>
          </div>
        </article>
      </div>

      {ga4Sync?.ok && ga4Sync.totals ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <h3 className="font-display text-base font-semibold text-foreground">
            {text("sourcesLast7")}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">{text("ga4ActiveUsers")}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatCount(ga4Sync.totals.activeUsers, locale)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">{text("sourcesSessions")}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatCount(ga4Sync.totals.sessions, locale)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">{text("sourcesPageViews")}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatCount(ga4Sync.totals.screenPageViews, locale)}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
