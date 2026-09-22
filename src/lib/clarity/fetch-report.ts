import {
  ensureClarityDataSource,
  getClarityApiToken,
  getClarityProjectId,
  hasClarityCredentials,
} from "@/lib/analytics/clarity-source";
import {
  type AnalyticsPeriodId,
  resolveAnalyticsPeriod,
} from "@/lib/analytics/period";

const CLARITY_EXPORT_URL =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

type ClarityInfoRow = Record<string, string | number | undefined | null>;

type ClarityMetricBlock = {
  metricName?: string;
  information?: ClarityInfoRow | ClarityInfoRow[];
};

export type ClarityNamedCount = {
  name: string;
  value: number;
};

export type ClarityDashboardData = {
  live: true;
  projectId: string;
  authMode: "api_token";
  periodLabel: string;
  numOfDays: 1 | 2 | 3;
  /** API max is 3 days — true when UI period is longer. */
  periodClamped: boolean;
  users: {
    uniqueUsers: number;
    sessions: number;
    botSessions: number;
    humanSessions: number;
  };
  behavior: {
    pagesPerSession: number;
    scrollDepthPercent: number | null;
    activeTimeSeconds: number | null;
  };
  interactions: {
    rageClicks: number;
    deadClicks: number;
    excessiveScroll: number;
    quickbackClicks: number;
    errorClicks: number;
    scriptErrors: number;
  };
  devices: ClarityNamedCount[];
  popularPages: ClarityNamedCount[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeMetricName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, "");
}

function asRows(
  information: ClarityInfoRow | ClarityInfoRow[] | undefined
): ClarityInfoRow[] {
  if (!information) return [];
  return Array.isArray(information) ? information : [information];
}

/** Clarity API only allows 1–3 days. */
export function clarityNumOfDaysForPeriod(
  periodId: AnalyticsPeriodId | string | null | undefined
): 1 | 2 | 3 {
  const period = resolveAnalyticsPeriod(periodId);
  if (period.id === "24h") return 1;
  if (period.id === "3d") return 3;
  return 3;
}

function findMetric(
  blocks: ClarityMetricBlock[],
  ...names: string[]
): ClarityInfoRow[] {
  const wanted = new Set(names.map(normalizeMetricName));
  const block = blocks.find((b) =>
    wanted.has(normalizeMetricName(b.metricName ?? ""))
  );
  return asRows(block?.information);
}

function sumField(rows: ClarityInfoRow[], ...fields: string[]): number {
  return rows.reduce((acc, row) => {
    for (const field of fields) {
      if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
        return acc + toNumber(row[field]);
      }
    }
    return acc;
  }, 0);
}

function firstNumber(rows: ClarityInfoRow[], ...fields: string[]): number | null {
  for (const row of rows) {
    for (const field of fields) {
      if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
        return toNumber(row[field]);
      }
    }
  }
  return null;
}

function namedCounts(
  rows: ClarityInfoRow[],
  nameKeys: string[],
  valueKeys: string[]
): ClarityNamedCount[] {
  return rows
    .map((row) => {
      const nameKey = nameKeys.find((k) => row[k] != null && String(row[k]));
      const valueKey = valueKeys.find(
        (k) => row[k] !== undefined && row[k] !== null && row[k] !== ""
      );
      return {
        name: nameKey ? String(row[nameKey]) : "Unknown",
        value: valueKey ? toNumber(row[valueKey]) : 0,
      };
    })
    .filter((r) => r.name && r.name !== "null" && r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

/** Event-style metrics use `subTotal` (not sessionsCount). */
function metricEventTotal(rows: ClarityInfoRow[]): number {
  const sub = sumField(rows, "subTotal");
  if (sub > 0) return sub;
  return rows.reduce((acc, row) => {
    const pct = toNumber(row.sessionsWithMetricPercentage);
    const sessions = toNumber(row.sessionsCount);
    if (pct > 0 && sessions > 0) {
      return acc + Math.round((pct / 100) * sessions);
    }
    return acc;
  }, 0);
}

async function callClarityExport(params: URLSearchParams, token: string) {
  const response = await fetch(`${CLARITY_EXPORT_URL}?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("Clarity API token is invalid or unauthorized.");
    }
    if (response.status === 429) {
      throw new Error(
        "Clarity daily API limit exceeded (max 10 requests/project/day)."
      );
    }
    throw new Error(
      `Clarity API error ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }

  const payload = (await response.json()) as ClarityMetricBlock[];
  return Array.isArray(payload) ? payload : [];
}

export async function fetchClarityLiveInsights(input?: {
  period?: string | null;
}): Promise<ClarityDashboardData> {
  if (!hasClarityCredentials()) {
    throw new Error(
      "Clarity is not configured. Set CLARITY_PROJECT_ID and CLARITY_API_TOKEN."
    );
  }

  const token = getClarityApiToken()!;
  const projectId = getClarityProjectId()!;
  const period = resolveAnalyticsPeriod(input?.period);
  const numOfDays = clarityNumOfDaysForPeriod(period.id);
  const periodClamped =
    period.id === "7d" || period.id === "28d" || period.id === "90d";

  try {
    await ensureClarityDataSource();
  } catch {
    // Optional DB row — fetch still works from env.
  }

  // Sem dimension: inclui PopularPages + Device + totais agregados (1 request).
  const blocks = await callClarityExport(
    new URLSearchParams({ numOfDays: String(numOfDays) }),
    token
  );

  const traffic = findMetric(blocks, "Traffic");
  const scroll = findMetric(blocks, "ScrollDepth", "Scroll Depth");
  const engagement = findMetric(blocks, "EngagementTime", "Engagement Time");
  const dead = findMetric(blocks, "DeadClickCount", "Dead Click Count");
  const rage = findMetric(blocks, "RageClickCount", "Rage Click Count");
  const excessive = findMetric(blocks, "ExcessiveScroll", "Excessive Scroll");
  const quickback = findMetric(blocks, "QuickbackClick", "Quickback Click");
  const errorClicks = findMetric(blocks, "ErrorClickCount", "Error Click Count");
  const scriptErrors = findMetric(
    blocks,
    "ScriptErrorCount",
    "Script Error Count"
  );
  const devicesRaw = findMetric(blocks, "Device");
  const popular = findMetric(blocks, "PopularPages", "Popular Pages");
  const pageTitles = findMetric(blocks, "PageTitle", "Page Title");

  const sessions = sumField(traffic, "totalSessionCount");
  const botSessions = sumField(traffic, "totalBotSessionCount");
  const uniqueUsers = sumField(
    traffic,
    "distinctUserCount",
    "distantUserCount"
  );

  const pagesPerSession =
    firstNumber(traffic, "pagesPerSessionPercentage", "PagesPerSessionPercentage") ??
    0;

  const scrollDepth = firstNumber(
    scroll,
    "averageScrollDepth",
    "AverageScrollDepth",
    "scrollDepth"
  );

  const activeTime = firstNumber(
    engagement,
    "activeTime",
    "ActiveTime",
    "averageEngagementTime"
  );

  const devices = namedCounts(
    devicesRaw,
    ["name", "Device", "device"],
    ["sessionsCount", "totalSessionCount", "visitsCount"]
  );

  let popularPages = namedCounts(
    popular,
    ["url", "URL", "Url"],
    ["visitsCount", "sessionsCount", "totalSessionCount"]
  );

  if (popularPages.length === 0) {
    popularPages = namedCounts(
      pageTitles,
      ["name", "PageTitle", "pageTitle"],
      ["sessionsCount", "visitsCount"]
    );
  }

  // Encurta URLs longas para a UI
  popularPages = popularPages.map((page) => {
    try {
      const u = new URL(page.name);
      return { ...page, name: `${u.pathname}${u.search}` || page.name };
    } catch {
      return page;
    }
  });

  return {
    live: true,
    projectId,
    authMode: "api_token",
    periodLabel:
      numOfDays === 1
        ? "Últimas 24h (Clarity)"
        : `Últimos ${numOfDays} dias (Clarity)`,
    numOfDays,
    periodClamped,
    users: {
      uniqueUsers,
      sessions,
      botSessions,
      humanSessions: Math.max(0, sessions - botSessions),
    },
    behavior: {
      pagesPerSession,
      scrollDepthPercent: scrollDepth,
      activeTimeSeconds: activeTime,
    },
    interactions: {
      rageClicks: metricEventTotal(rage),
      deadClicks: metricEventTotal(dead),
      excessiveScroll: metricEventTotal(excessive),
      quickbackClicks: metricEventTotal(quickback),
      errorClicks: metricEventTotal(errorClicks),
      scriptErrors: metricEventTotal(scriptErrors),
    },
    devices,
    popularPages,
  };
}

/** Convenience for Data Sources “Sync metrics”. */
export async function fetchClaritySyncPreview() {
  const report = await fetchClarityLiveInsights({ period: "3d" });
  return {
    periodLabel: report.periodLabel,
    totals: {
      sessions: report.users.sessions,
      distantUsers: report.users.uniqueUsers,
      rageClicks: report.interactions.rageClicks,
      deadClicks: report.interactions.deadClicks,
    },
  };
}

/** @deprecated Use ClarityDashboardData */
export type ClarityDashboardSummary = ClarityDashboardData;
