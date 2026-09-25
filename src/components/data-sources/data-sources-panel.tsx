"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

type Ga4ConnectionStatus = {
  connected: boolean;
  status: string;
  authMode?: "service_account" | "oauth" | null;
};

type ClarityConnectionStatus = {
  connected: boolean;
  status: string;
};

type VercelConnectionStatus = {
  connected: boolean;
  status: string;
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

type ClaritySyncResult = {
  ok: boolean;
  error?: string;
  periodLabel?: string;
  totals?: {
    sessions: number;
    distantUsers: number;
    rageClicks: number;
    deadClicks: number;
  };
};

type VercelSyncResult = {
  ok: boolean;
  error?: string;
  periodLabel?: string;
  totals?: {
    visitors: number;
    pageviews: number;
  };
};

type Props = {
  initialGa4: Ga4ConnectionStatus;
  initialClarity: ClarityConnectionStatus;
  initialVercel: VercelConnectionStatus;
};

export function DataSourcesPanel({
  initialGa4,
  initialClarity,
  initialVercel,
}: Props) {
  const searchParams = useSearchParams();
  const oauthMessage =
    searchParams.get("connected") === "ga4"
      ? "Google Analytics connected successfully."
      : null;
  const oauthError = searchParams.get("error");

  const [ga4, setGa4] = useState<Ga4ConnectionStatus>(initialGa4);
  const [clarity, setClarity] =
    useState<ClarityConnectionStatus>(initialClarity);
  const [vercel, setVercel] = useState<VercelConnectionStatus>(initialVercel);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ga4Syncing, setGa4Syncing] = useState(false);
  const [claritySyncing, setClaritySyncing] = useState(false);
  const [vercelSyncing, setVercelSyncing] = useState(false);
  const [ga4Sync, setGa4Sync] = useState<Ga4SyncResult | null>(null);
  const [claritySync, setClaritySync] = useState<ClaritySyncResult | null>(
    null
  );
  const [vercelSync, setVercelSync] = useState<VercelSyncResult | null>(null);

  const message = localMessage ?? oauthMessage;
  const error = localError ?? oauthError;
  const ga4Connected = Boolean(ga4.connected);
  const clarityConnected = Boolean(clarity.connected);
  const vercelConnected = Boolean(vercel.connected);

  async function refreshStatus() {
    const response = await fetch("/api/data-sources/status");
    const data = (await response.json()) as {
      ga4?: Ga4ConnectionStatus;
      clarity?: ClarityConnectionStatus;
      vercel?: VercelConnectionStatus;
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
    if (data.clarity) setClarity(data.clarity);
    if (data.vercel) setVercel(data.vercel);
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

  async function handleClaritySync() {
    setClaritySyncing(true);
    setLocalError(null);
    setClaritySync(null);

    try {
      const response = await fetch("/api/clarity/sync", { method: "POST" });
      const data = (await response.json()) as ClaritySyncResult;
      setClaritySync(data);
      if (!response.ok || !data.ok) {
        setLocalError(data.error ?? "Clarity sync failed");
      } else {
        setLocalMessage(
          `Clarity metrics synced (${data.periodLabel ?? "últimos dias"}).`
        );
        await refreshStatus();
      }
    } catch {
      setLocalError("Clarity sync request failed");
    } finally {
      setClaritySyncing(false);
    }
  }

  async function handleVercelSync() {
    setVercelSyncing(true);
    setLocalError(null);
    setVercelSync(null);

    try {
      const response = await fetch("/api/vercel/sync", { method: "POST" });
      const data = (await response.json()) as VercelSyncResult;
      setVercelSync(data);
      if (!response.ok || !data.ok) {
        setLocalError(data.error ?? "Vercel sync failed");
      } else {
        setLocalMessage(
          `Vercel metrics synced (${data.periodLabel ?? "últimos 7 dias"}).`
        );
        await refreshStatus();
      }
    } catch {
      setLocalError("Vercel sync request failed");
    } finally {
      setVercelSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Data Sources
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Connect analytics platforms to power dashboards and Humana Analytics.
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
              Microsoft Clarity
            </h2>
            <p className="mt-1 text-sm text-muted">
              Comportamento, cliques e fricção na interface.
            </p>
            <p
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${
                clarityConnected
                  ? "bg-accent-soft text-accent"
                  : "bg-[#f1f1f1] text-[#5f5f5f]"
              }`}
            >
              {clarityConnected ? "Connected" : "Not connected"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleClaritySync()}
              disabled={!clarityConnected || claritySyncing}
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {claritySyncing ? "Syncing…" : "Sync metrics"}
            </button>
          </div>
        </article>

        <article className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Vercel Analytics
            </h2>
            <p className="mt-1 text-sm text-muted">
              Visitantes, pageviews e origem do tráfego.
            </p>
            <p
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs ${
                vercelConnected
                  ? "bg-accent-soft text-accent"
                  : "bg-[#f1f1f1] text-[#5f5f5f]"
              }`}
            >
              {vercelConnected ? "Connected" : "Not connected"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleVercelSync()}
              disabled={!vercelConnected || vercelSyncing}
              className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {vercelSyncing ? "Syncing…" : "Sync metrics"}
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

      {claritySync?.ok && claritySync.totals ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <h3 className="font-display text-base font-semibold text-foreground">
            {claritySync.periodLabel ?? "Clarity"}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Sessions</p>
              <p className="mt-1 text-xl font-semibold">
                {claritySync.totals.sessions.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Users</p>
              <p className="mt-1 text-xl font-semibold">
                {claritySync.totals.distantUsers.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Rage clicks</p>
              <p className="mt-1 text-xl font-semibold">
                {claritySync.totals.rageClicks.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Dead clicks</p>
              <p className="mt-1 text-xl font-semibold">
                {claritySync.totals.deadClicks.toLocaleString("en-US")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {vercelSync?.ok && vercelSync.totals ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <h3 className="font-display text-base font-semibold text-foreground">
            {vercelSync.periodLabel ?? "Vercel"}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Visitors</p>
              <p className="mt-1 text-xl font-semibold">
                {vercelSync.totals.visitors.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Pageviews</p>
              <p className="mt-1 text-xl font-semibold">
                {vercelSync.totals.pageviews.toLocaleString("en-US")}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
