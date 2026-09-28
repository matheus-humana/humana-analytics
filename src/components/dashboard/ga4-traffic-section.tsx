"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { DashboardHeader, LiveGa4Dashboard } from "@/components/dashboard/live-ga4-dashboard";
import { FreshnessBadge } from "@/components/freshness/freshness-badge";
import { useLocale } from "@/components/i18n/locale-provider";
import type { AnalyticsPeriodId } from "@/lib/analytics/period";
import { GA4_POLL_INTERVAL_MS } from "@/lib/freshness/status";
import type { Ga4DashboardSnapshot } from "@/lib/ga4/dashboard-cache";
import { workspaceCopy } from "@/lib/i18n/workspace-copy";

type Props = {
  periodId: AnalyticsPeriodId;
  initial: Ga4DashboardSnapshot | null;
  initialError: string | null;
};

export function Ga4TrafficSection({
  periodId,
  initial,
  initialError,
}: Props) {
  const { locale } = useLocale();

  const serverKey = `${periodId}:${initial?.fetchedAt ?? ""}:${initialError ?? ""}`;
  const [generation, setGeneration] = useState(serverKey);
  const [polled, setPolled] = useState<Ga4DashboardSnapshot | null>(null);
  const [pollOk, setPollOk] = useState<boolean | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  if (generation !== serverKey) {
    setGeneration(serverKey);
    setPolled(null);
    setPollOk(null);
    setPollError(null);
  }

  const data = polled ?? initial;
  const ok = pollOk ?? (initial != null && initialError == null);
  const error = pollError ?? initialError;
  const fetchedAt = data?.fetchedAt ?? null;
  const fetchedAtRef = useRef(fetchedAt);

  useEffect(() => {
    fetchedAtRef.current = fetchedAt;
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(
          `/api/ga4/dashboard?period=${encodeURIComponent(periodId)}`,
          { cache: "no-store" }
        );
        const body = (await response.json()) as {
          ok?: boolean;
          error?: string;
          data?: Ga4DashboardSnapshot;
        };
        if (cancelled) return;
        if (!response.ok || !body.ok || !body.data?.fetchedAt) {
          setPollOk(false);
          if (!fetchedAtRef.current) {
            setPollError(body.error ?? workspaceCopy["pt-BR"].ga4LoadFailed);
          }
          return;
        }
        fetchedAtRef.current = body.data.fetchedAt;
        setPollOk(true);
        setPollError(null);
        setPolled(body.data);
      } catch {
        if (!cancelled) setPollOk(false);
      }
    }

    function due() {
      const stamp = fetchedAtRef.current;
      if (!stamp) return false;
      const elapsed = Date.now() - Date.parse(stamp);
      return Number.isNaN(elapsed) || elapsed >= GA4_POLL_INTERVAL_MS;
    }

    if (due()) void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, GA4_POLL_INTERVAL_MS);

    function onVisible() {
      if (due()) void poll();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [periodId, fetchedAt]);

  const freshness: ReactNode = (
    <FreshnessBadge
      cadence="live"
      observedAt={data?.fetchedAt ?? null}
      ok={ok && data != null}
      locale={locale}
    />
  );

  return (
    <div className="space-y-4">
      <DashboardHeader
        locale={locale}
        periodId={periodId}
        error={data ? null : error}
        freshness={freshness}
      />
      {data ? <LiveGa4Dashboard data={data} locale={locale} periodId={periodId} /> : null}
    </div>
  );
}
