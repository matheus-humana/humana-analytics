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
    const key = `${citation.source}\u0000${citation.period ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(citation);
  }
  return unique;
}

export function buildSourcesBlock(citations: Citation[], locale: ChatLocale): string {
  const unique = dedupeCitations(citations);
  if (unique.length === 0) return "";
  const lines = unique.map((citation) => {
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
  const draft = stripModelSources(input.draft);
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

  return `${body}${buildSourcesBlock(input.citations, input.locale)}`.trim();
}
