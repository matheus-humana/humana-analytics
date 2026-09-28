"use client";

import { useEffect, useState } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import {
  describeFreshness,
  type FreshnessCadence,
  type FreshnessTone,
} from "@/lib/freshness/status";

const TONE_DOT: Record<FreshnessTone, string> = {
  green: "bg-status-on",
  blue: "bg-accent",
  amber: "bg-warning",
  gray: "bg-border",
};

const TONE_TEXT: Record<FreshnessTone, string> = {
  green: "text-positive",
  blue: "text-foreground",
  amber: "text-warning",
  gray: "text-muted",
};

type Props = {
  cadence: FreshnessCadence;
  observedAt: string | null;
  ok: boolean;
  locale: ChatLocale;
};

export function FreshnessBadge({ cadence, observedAt, ok, locale }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null) {
    return (
      <span className="inline-flex h-5 items-center" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-border" />
      </span>
    );
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const view = describeFreshness({
    cadence,
    observedAt,
    ok,
    now,
    timeZone,
    locale,
  });

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${TONE_TEXT[view.tone]}`}
      title={view.label}
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[view.tone]} ${
          view.pulse ? "ha-live-dot" : ""
        }`}
      />
      <span>{view.label}</span>
    </span>
  );
}
