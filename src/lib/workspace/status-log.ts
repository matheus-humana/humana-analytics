import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";

import { intlLocale } from "@/lib/i18n/format";
import { workspaceText } from "@/lib/i18n/workspace-copy";

export const CONNECTION_PROVIDERS = [
  "ga4",
  "github",
  "pagespeed",
  "crawl",
] as const;

export type ConnectionProvider = (typeof CONNECTION_PROVIDERS)[number];

export type ConnectionSnapshot = {
  provider: ConnectionProvider;
  connected: boolean;
  status: string;
  updatedAt: string | null;
  /** Machine code (`missing_token`) or the provider's own error text. */
  detail?: string | null;
};

export type ChatSignal = {
  id: string;
  kind: "question" | "reply";
  at: string;
};

export type StatusItem = {
  id: string;
  at: string | null;
  text: string;
};

function providerLabel(provider: ConnectionProvider, locale: ChatLocale): string {
  if (provider === "ga4") return "GA4";
  if (provider === "github") return "GitHub";
  if (provider === "pagespeed") return "PageSpeed";
  return workspaceText(locale, "connCrawlShort");
}

function validTime(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function formatStatusStamp(iso: string, locale: ChatLocale): string | null {
  const time = validTime(iso);
  if (time == null) return null;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

export function describeConnection(
  connection: ConnectionSnapshot,
  locale: ChatLocale
): string {
  const name = providerLabel(connection.provider, locale);
  const state =
    connection.status === "error"
      ? workspaceText(locale, "statusError")
      : connection.connected
        ? workspaceText(locale, "statusConnected")
        : workspaceText(locale, "statusDisconnected");
  const stamp = connection.updatedAt
    ? formatStatusStamp(connection.updatedAt, locale)
    : null;
  const base = stamp
    ? `${name} · ${state} · ${workspaceText(locale, "statusUpdated")} ${stamp}`
    : `${name} · ${state}`;
  const extra = connectionDetail(connection, locale);
  return extra ? `${base} · ${extra}` : base;
}

function connectionDetail(
  connection: ConnectionSnapshot,
  locale: ChatLocale
): string | null {
  const detail = connection.detail?.trim();
  if (!detail) return null;
  if (detail === "missing_token") return workspaceText(locale, "statusGithubMissingToken");
  if (detail === "missing_repo") return workspaceText(locale, "statusGithubMissingRepo");
  if (detail.startsWith("invalid_repo")) {
    const sample = detail.slice("invalid_repo".length).replace(/^:/, "").trim();
    const label = workspaceText(locale, "statusGithubInvalidRepo");
    return sample ? `${label} (${sample})` : label;
  }
  if (detail === "missing_site_url") return workspaceText(locale, "statusMissingSiteUrl");
  if (detail === "invalid_site_url") return workspaceText(locale, "statusInvalidSiteUrl");
  if (detail === "no_snapshot") return workspaceText(locale, "statusNoSnapshot");
  if (
    (connection.provider === "pagespeed" || connection.provider === "crawl") &&
    detail
  ) {
    return detail;
  }
  if (connection.status === "error") return detail;
  return null;
}

export function describeChat(signal: ChatSignal, locale: ChatLocale): string {
  const label = workspaceText(
    locale,
    signal.kind === "question" ? "eventQuestion" : "eventReply"
  );
  const stamp = formatStatusStamp(signal.at, locale);
  return stamp ? `${label} · ${stamp}` : label;
}

export function buildStatusLog(
  connections: ConnectionSnapshot[],
  chatSignals: ChatSignal[],
  locale: ChatLocale
): { line: string | null; items: StatusItem[] } {
  const items: Array<StatusItem & { time: number | null }> = [];

  for (const signal of chatSignals) {
    const time = validTime(signal.at);
    items.push({
      id: `chat:${signal.id}`,
      at: time == null ? null : signal.at,
      time,
      text: describeChat(signal, locale),
    });
  }

  for (const connection of connections) {
    const time = validTime(connection.updatedAt);
    items.push({
      id: `connection:${connection.provider}`,
      at: time == null ? null : connection.updatedAt,
      time,
      text: describeConnection(connection, locale),
    });
  }

  items.sort((a, b) => {
    if (a.time == null && b.time == null) return 0;
    if (a.time == null) return 1;
    if (b.time == null) return -1;
    return b.time - a.time;
  });

  const newest = items.find((item) => item.time != null);
  if (newest) {
    return {
      line: newest.text,
      items: items.map(({ id, at, text }) => ({ id, at, text })),
    };
  }

  if (connections.length > 0) {
    return {
      line: connections.map((connection) => describeConnection(connection, locale)).join(" · "),
      items: items.map(({ id, at, text }) => ({ id, at, text })),
    };
  }

  return {
    line: null,
    items: [],
  };
}
