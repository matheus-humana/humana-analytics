import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import type { AnalyticsPeriodId } from "@/lib/analytics/period";

import { workspaceText, type WorkspaceMessageKey } from "./workspace-copy";

const LABELS: Record<AnalyticsPeriodId, WorkspaceMessageKey> = {
  "24h": "periodLabel24h",
  "3d": "periodLabel3d",
  "7d": "periodLabel7d",
  "28d": "periodLabel28d",
  "90d": "periodLabel90d",
};

const SHORTS: Record<AnalyticsPeriodId, WorkspaceMessageKey> = {
  "24h": "periodShort24h",
  "3d": "periodShort3d",
  "7d": "githubPeriod7",
  "28d": "githubPeriod28",
  "90d": "githubPeriod90",
};

export function periodLabel(locale: ChatLocale, id: AnalyticsPeriodId): string {
  return workspaceText(locale, LABELS[id]);
}

export function periodShortLabel(locale: ChatLocale, id: AnalyticsPeriodId): string {
  return workspaceText(locale, SHORTS[id]);
}
