import {
  ensureVercelDataSource,
  getVercelAccessToken,
  getVercelProjectId,
  getVercelTeamId,
  hasVercelCredentials,
} from "@/lib/analytics/vercel-source";
import {
  type AnalyticsPeriodId,
  resolveAnalyticsPeriod,
} from "@/lib/analytics/period";

const WEB_ANALYTICS_BASE =
  "https://api.vercel.com/v1/query/web-analytics";

export type VercelNamedCount = {
  name: string;
  value: number;
};

export type VercelDashboardData = {
  live: true;
  projectId: string;
  authMode: "api_token";
  periodLabel: string;
  since: string;
  until: string;
  overview: {
    visitors: number;
    pageviews: number;
  };
  topPaths: VercelNamedCount[];
  devices: VercelNamedCount[];
  referrers: VercelNamedCount[];
  countries: VercelNamedCount[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function periodToDateRange(periodId: AnalyticsPeriodId | string | null | undefined): {
  since: string;
  until: string;
  label: string;
} {
  const period = resolveAnalyticsPeriod(periodId);
  const until = new Date();
  const since = new Date();
  const hours = period.rollingHours ?? 168;
  since.setTime(until.getTime() - hours * 60 * 60 * 1000);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    since: fmt(since),
    until: fmt(until),
    label: period.label,
  };
}

async function vercelGet(
  path: string,
  search: Record<string, string | undefined>
): Promise<unknown> {
  const token = getVercelAccessToken();
  const projectId = getVercelProjectId();
  if (!token || !projectId) {
    throw new Error(
      "Vercel is not configured. Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID."
    );
  }

  const params = new URLSearchParams();
  params.set("projectId", projectId);
  const teamId = getVercelTeamId();
  if (teamId) params.set("teamId", teamId);

  for (const [key, value] of Object.entries(search)) {
    if (value != null && value !== "") params.set(key, value);
  }

  const response = await fetch(`${WEB_ANALYTICS_BASE}${path}?${params}`, {
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
      throw new Error(
        "Vercel token inválido ou sem permissão para Web Analytics deste projeto."
      );
    }
    throw new Error(
      `Vercel API error ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`
    );
  }

  return response.json();
}

function rowsFromAggregate(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object"
    );
  }
  return [];
}

function namedFromRows(
  rows: Record<string, unknown>[],
  nameKeys: string[],
  valueKeys: string[]
): VercelNamedCount[] {
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
    .filter((r) => r.name && r.name !== "Others" && r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export async function fetchVercelDashboard(input?: {
  period?: string | null;
}): Promise<VercelDashboardData> {
  if (!hasVercelCredentials()) {
    throw new Error(
      "Vercel is not configured. Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID."
    );
  }

  const projectId = getVercelProjectId()!;
  const { since, until, label } = periodToDateRange(input?.period);

  try {
    await ensureVercelDataSource();
  } catch {
    // optional DB
  }

  const [
    countPayload,
    pathsPayload,
    devicesPayload,
    referrersPayload,
    countriesPayload,
  ] = await Promise.all([
    vercelGet("/visits/aggregate", {
      since,
      until,
      by: "day",
    }),
    vercelGet("/visits/aggregate", {
      since,
      until,
      by: "requestPath",
      limit: "8",
    }),
    vercelGet("/visits/aggregate", {
      since,
      until,
      by: "deviceType",
      limit: "6",
    }),
    vercelGet("/visits/aggregate", {
      since,
      until,
      by: "referrerHostname",
      limit: "8",
    }),
    vercelGet("/visits/aggregate", {
      since,
      until,
      by: "country",
      limit: "6",
    }),
  ]);

  const dayRows = rowsFromAggregate(countPayload);
  let overviewVisitors = dayRows.reduce(
    (acc, row) => acc + toNumber(row.visitors),
    0
  );
  let overviewPageviews = dayRows.reduce(
    (acc, row) => acc + toNumber(row.pageviews),
    0
  );

  if (overviewVisitors === 0 && overviewPageviews === 0) {
    try {
      const total = (await vercelGet("/visits/count", {
        since,
        until,
      })) as { data?: { visitors?: number; pageviews?: number } };
      overviewVisitors = toNumber(total.data?.visitors);
      overviewPageviews = toNumber(total.data?.pageviews);
    } catch {
      // keep zeros
    }
  }

  return {
    live: true,
    projectId,
    authMode: "api_token",
    periodLabel: `${label} (Vercel)`,
    since,
    until,
    overview: {
      visitors: overviewVisitors,
      pageviews: overviewPageviews,
    },
    topPaths: namedFromRows(
      rowsFromAggregate(pathsPayload),
      ["requestPath", "path", "route"],
      ["pageviews", "visitors"]
    ),
    devices: namedFromRows(
      rowsFromAggregate(devicesPayload),
      ["deviceType", "device"],
      ["pageviews", "visitors"]
    ),
    referrers: namedFromRows(
      rowsFromAggregate(referrersPayload),
      ["referrerHostname", "referrer"],
      ["pageviews", "visitors"]
    ),
    countries: namedFromRows(
      rowsFromAggregate(countriesPayload),
      ["country"],
      ["pageviews", "visitors"]
    ),
  };
}

export async function fetchVercelSyncPreview() {
  const report = await fetchVercelDashboard({ period: "7d" });
  return {
    periodLabel: report.periodLabel,
    totals: {
      visitors: report.overview.visitors,
      pageviews: report.overview.pageviews,
    },
  };
}
