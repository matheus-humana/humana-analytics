import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

/**
 * Honest freshness for on-screen data.
 *
 * GA4 is polled while the tab is visible. A short server cache absorbs
 * overlapping tabs so the Data API is not called on every refresh.
 * GitHub, PageSpeed and the site crawl are snapshots stored per day (Vercel
 * Cron: GitHub hourly at :15, PageSpeed and crawl daily around 08:20–08:40
 * UTC). Those are never shown as live.
 *
 * Limits:
 * - GA4 server cache: 120 seconds
 * - GA4 poll while the tab is visible: 3 minutes
 * - Live (green pulse): last successful GA4 read is at most 10 minutes old
 * - Live stale (amber, no pulse): older than 10 minutes, or the latest read failed
 * - Snapshot fresh (blue, no pulse): last collect is at most 36 hours old
 * - Snapshot stale (amber): older than 36 hours, or the source reported an error
 * - Unavailable (gray): no timestamp, or a timestamp more than 2 minutes in the future
 */
export const GA4_CACHE_SECONDS = 120;
export const GA4_POLL_INTERVAL_MS = 3 * 60 * 1000;
export const LIVE_FRESH_MS = 10 * 60 * 1000;
export const SNAPSHOT_FRESH_MS = 36 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 2 * 60 * 1000;

export type FreshnessCadence = "live" | "snapshot";
export type FreshnessKind = "live" | "snapshot" | "stale" | "unavailable";
export type FreshnessTone = "green" | "blue" | "amber" | "gray";

export type FreshnessInput = {
  cadence: FreshnessCadence;
  /** ISO time of the last successful read or collect. */
  observedAt: string | null;
  /** False when the latest attempt failed or the source is disconnected. */
  ok: boolean;
  now: number;
  timeZone: string;
  locale: ChatLocale;
};

export type FreshnessView = {
  kind: FreshnessKind;
  tone: FreshnessTone;
  pulse: boolean;
  label: string;
};

export function describeFreshness(input: FreshnessInput): FreshnessView {
  const observed = observedMillis(input.observedAt, input.now);
  if (observed == null) {
    return unavailable(input.cadence, input.locale);
  }

  const age = input.now - observed;
  if (input.cadence === "live") {
    return describeLive(age, input.ok, input);
  }
  return describeSnapshot(age, input.ok, observed, input);
}

function describeLive(
  age: number,
  ok: boolean,
  input: FreshnessInput
): FreshnessView {
  const locale = input.locale;
  if (!ok) {
    return {
      kind: "stale",
      tone: "amber",
      pulse: false,
      label:
        locale === "en"
          ? `Update failed · last read ${relative(age, locale)}`
          : `Falha ao atualizar · última leitura ${relative(age, locale)}`,
    };
  }
  if (age <= LIVE_FRESH_MS) {
    return {
      kind: "live",
      tone: "green",
      pulse: true,
      label:
        locale === "en"
          ? `Live · updated ${relative(age, locale)}`
          : `Ao vivo · atualizado ${relative(age, locale)}`,
    };
  }
  return {
    kind: "stale",
    tone: "amber",
    pulse: false,
    label:
      locale === "en"
        ? `Out of date · ${relative(age, locale)}`
        : `Desatualizado · ${relative(age, locale)}`,
  };
}

function describeSnapshot(
  age: number,
  ok: boolean,
  observed: number,
  input: FreshnessInput
): FreshnessView {
  const locale = input.locale;
  const when = snapshotWhen(observed, input.now, input.timeZone, locale);
  if (!ok || age > SNAPSHOT_FRESH_MS) {
    return {
      kind: "stale",
      tone: "amber",
      pulse: false,
      label:
        locale === "en"
          ? `Out of date · last collect ${when}`
          : `Desatualizado · última coleta ${when}`,
    };
  }
  return {
    kind: "snapshot",
    tone: "blue",
    pulse: false,
    label: locale === "en" ? `Updated ${when}` : `Atualizado ${when}`,
  };
}

function unavailable(cadence: FreshnessCadence, locale: ChatLocale): FreshnessView {
  return {
    kind: "unavailable",
    tone: "gray",
    pulse: false,
    label:
      cadence === "snapshot"
        ? locale === "en"
          ? "No snapshot yet"
          : "Sem coleta"
        : locale === "en"
          ? "No update yet"
          : "Sem atualização",
  };
}

function observedMillis(value: string | null, now: number): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  if (time - now > FUTURE_SKEW_MS) return null;
  return Math.min(time, now);
}

function relative(ageMs: number, locale: ChatLocale): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 45) return locale === "en" ? "just now" : "agora";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return locale === "en" ? "1 min ago" : "há 1 min";
  if (minutes < 60) {
    return locale === "en" ? `${minutes} min ago` : `há ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    if (locale === "en") return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    return `há ${hours} h`;
  }

  const days = Math.floor(hours / 24);
  if (locale === "en") return days === 1 ? "1 day ago" : `${days} days ago`;
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

function snapshotWhen(
  observed: number,
  now: number,
  timeZone: string,
  locale: ChatLocale
): string {
  const time = clock(observed, timeZone);
  const day = dayKey(observed, timeZone);
  const today = dayKey(now, timeZone);
  if (day === today) {
    return locale === "en" ? `today, ${time}` : `hoje, ${time}`;
  }
  if (day === previousDayKey(now, timeZone)) {
    return locale === "en" ? `yesterday, ${time}` : `ontem, ${time}`;
  }
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(observed));
  return locale === "en" ? `on ${date}, ${time}` : `em ${date}, ${time}`;
}

function clock(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function dayKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function previousDayKey(now: number, timeZone: string): string {
  const today = dayKey(now, timeZone);
  for (let hours = 1; hours <= 30; hours += 1) {
    const key = dayKey(now - hours * 60 * 60 * 1000, timeZone);
    if (key !== today) return key;
  }
  return dayKey(now - 24 * 60 * 60 * 1000, timeZone);
}
