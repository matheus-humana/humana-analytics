import { isAnalyticsPeriodId } from "@/lib/analytics/period";
import { periodLabel } from "@/lib/i18n/period-label";
import { workspaceText } from "@/lib/i18n/workspace-copy";

import type { ChatLocale } from "./analytics-bot-contract";
import type { Citation, ToolCallRecord } from "./tool-trace";

const QUALITATIVE_TOOLS = new Set(["get_project_context"]);
const PERIOD_PHRASE =
  /\b\d+\s*(?:h|hr|hrs|hour|hours|hora|horas|d|day|days|dia|dias|week|weeks|semana|semanas)\b/gi;

export function containsMetric(text: string): boolean {
  const stripped = text
    .replace(PERIOD_PHRASE, " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.Z+-]+)?\b/g, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
  return /\d/.test(stripped);
}

export function stripModelSources(answer: string): string {
  return answer.replace(/\n+#{0,3}\s*(?:fontes|sources)\b[\s\S]*$/i, "").trim();
}

const SPECIAL_SPACE = /[\u00A0\u2007\u2009\u202F]/g;
const SPACED_THOUSANDS = /\d{1,3}(?:[\u00A0\u2007\u2009\u202F]\d{3})+(?!\d)/g;

/** The chat renders plain text: drop bold/heading markers and use the locale's thousands separator. */
export function tidyModelText(text: string, locale: ChatLocale): string {
  const separator = locale === "en" ? "," : ".";
  return text
    .replace(SPACED_THOUSANDS, (digits) => digits.replace(SPECIAL_SPACE, separator))
    .replace(SPECIAL_SPACE, " ")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "");
}

export function hasQuantitativeSuccess(calls: ToolCallRecord[]): boolean {
  return calls.some((call) => call.ok && !QUALITATIVE_TOOLS.has(call.name));
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function formatPeriod(period: string | null, locale: ChatLocale): string {
  if (!period || period === "not-connected") {
    return period === "not-connected"
      ? workspaceText(locale, "sourcesDisconnected")
      : workspaceText(locale, "citationPeriodUnavailable");
  }
  const comparison = period.match(/^([a-z0-9]+) vs previous$/);
  if (comparison && isAnalyticsPeriodId(comparison[1])) {
    return fill(workspaceText(locale, "citationVsPrevious"), {
      period: periodLabel(locale, comparison[1]),
    });
  }
  if (isAnalyticsPeriodId(period)) return periodLabel(locale, period);
  return period;
}

function sourceLabel(source: string, locale: ChatLocale): string {
  if (source === "Project context") return workspaceText(locale, "citationProjectContext");
  return source;
}

export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const unique: Citation[] = [];
  for (const citation of citations) {
    if (!citation.source || citation.source === "unknown") continue;
    const key = citation.url ?? `${citation.source}\u0000${citation.period ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(citation);
  }
  return unique;
}

const GENERIC_SITE_SEGMENTS = new Set([
  "documentation",
  "docs",
  "blog",
  "articles",
  "article",
  "guide",
  "home",
  "news",
]);
const WEB_FALLBACK_COUNT = 3;

function squash(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

function siteNames(citation: Citation): string[] {
  const names: string[] = [];
  try {
    const host = new URL(citation.url ?? "").hostname.replace(/^www\./, "");
    names.push(squash(host));
    const labels = host.split(".");
    if (labels.length === 2 && labels[0].length >= 5) names.push(squash(labels[0]));
  } catch {
    return names;
  }
  for (const segment of citation.source.split(/\s+[|–—-]\s+/).slice(1)) {
    const name = squash(segment);
    if (name.length >= 4 && !GENERIC_SITE_SEGMENTS.has(name)) names.push(name);
  }
  return names;
}

/**
 * Keep the web pages the answer names (by site name or domain). When it names
 * none, keep the top results of the last search.
 */
export function selectWebCitations(citations: Citation[], answer: string): Citation[] {
  const web = citations.filter((citation) => citation.url);
  if (web.length === 0) return citations;
  const text = squash(answer);
  const named = new Set(
    web.filter((citation) => siteNames(citation).some((name) => text.includes(name)))
  );
  if (named.size === 0) {
    const lastSearch = web[web.length - 1].retrievedAt;
    for (const citation of web.filter((item) => item.retrievedAt === lastSearch).slice(0, WEB_FALLBACK_COUNT)) {
      named.add(citation);
    }
  }
  return citations.filter((citation) => !citation.url || named.has(citation));
}

export function buildSourcesBlock(citations: Citation[], locale: ChatLocale): string {
  const unique = dedupeCitations(citations);
  if (unique.length === 0) return "";
  const lines = unique.map((citation) => {
    if (citation.url) return `- ${citation.source} — ${citation.url}`;
    const period = formatPeriod(citation.period, locale);
    return `- ${sourceLabel(citation.source, locale)} · ${period} · ${citation.retrievedAt}`;
  });
  return `\n\n${workspaceText(locale, "chatSourcesHeading")}\n${lines.join("\n")}`;
}

export function finalizeAnswer(input: {
  draft: string;
  locale: ChatLocale;
  calls: ToolCallRecord[];
  citations: Citation[];
  disconnectedSources: string[];
}): string {
  const draft = tidyModelText(stripModelSources(input.draft), input.locale);
  const grounded = hasQuantitativeSuccess(input.calls);
  const disconnected = [...new Set(input.disconnectedSources.filter(Boolean))];
  let body = draft;

  if (containsMetric(draft) && !grounded) {
    body =
      disconnected.length > 0
        ? fill(workspaceText(input.locale, "sourceDisconnected"), {
            source: disconnected.join(", "),
          })
        : workspaceText(input.locale, "couldNotFetchData");
  } else if (disconnected.length > 0) {
    const line = fill(workspaceText(input.locale, "sourceDisconnected"), {
      source: disconnected.join(", "),
    });
    if (!body.includes(line)) {
      body = body ? `${body}\n\n${line}` : line;
    }
  }

  const citations = selectWebCitations(input.citations, draft);
  return `${body}${buildSourcesBlock(citations, input.locale)}`.trim();
}
