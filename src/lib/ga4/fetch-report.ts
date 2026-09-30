import type { AnalyticsPeriod } from "@/lib/analytics/period";
import { ensureGa4DataSource } from "@/lib/analytics/ga4-source";
import { decryptSecret } from "@/lib/crypto/token-encryption";
import { db } from "@/lib/db";
import { dataSourceCredentials, dataSources } from "@/lib/db/schema";
import {
  getServiceAccountAccessToken,
  hasGoogleServiceAccount,
} from "@/lib/google/service-account";
import { refreshAccessToken } from "@/lib/oauth/google";
import {
  percentChange,
  previousEquivalentRange,
  resolveAnalyticsPeriod,
} from "@/lib/analytics/period";
import { eq } from "drizzle-orm";

type Ga4MetricRow = {
  date: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
};

type Ga4ReportRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

export type Ga4NamedCount = {
  name: string;
  value: number;
};

export type Ga4ConversionMetric = {
  eventName: string;
  label: string;
  count: number;
};

export type Ga4DashboardData = {
  live: true;
  propertyId: string;
  authMode: "service_account" | "oauth";
  periodLabel: string;
  overview: {
    activeUsers: number;
    newUsers: number;
    engagedSessions: number;
    views: number;
    viewsPerActiveUser: number;
    averageEngagementSeconds: number;
    bounceRate: number;
    eventCount: number;
  };
  /** Contatos, newsletter, demo, download, login — quando o site dispara o evento. */
  conversions: Ga4ConversionMetric[];
  traffic: Array<{ day: string; users: number }>;
  topPages: Ga4NamedCount[];
  browsers: Ga4NamedCount[];
  operatingSystems: Ga4NamedCount[];
  platforms: Ga4NamedCount[];
  screenResolutions: Ga4NamedCount[];
};

/** Eventos de conversão/interação que o dashboard destaca. */
export const GA4_CONVERSION_EVENTS = [
  {
    eventName: "contact",
    label: "Contatos enviados",
  },
  {
    eventName: "sign_up",
    label: "Newsletters",
  },
  {
    eventName: "generate_lead",
    label: "Demos / leads",
  },
  {
    eventName: "file_download",
    label: "Downloads",
  },
  {
    eventName: "app_login",
    label: "Cliques em Login",
  },
] as const;

async function resolveAccessToken(): Promise<{
  accessToken: string;
  authMode: "service_account" | "oauth";
}> {
  if (hasGoogleServiceAccount()) {
    const accessToken = await getServiceAccountAccessToken();
    return { accessToken, authMode: "service_account" };
  }

  const source = (
    await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.provider, "ga4"))
      .limit(1)
  )[0];

  if (!source) {
    throw new Error("GA4 is not connected. Complete Google OAuth first.");
  }

  const credential = (
    await db
      .select()
      .from(dataSourceCredentials)
      .where(eq(dataSourceCredentials.dataSourceId, source.id))
      .limit(1)
  )[0];

  if (!credential) {
    throw new Error("GA4 is not connected. Complete Google OAuth first.");
  }

  const refreshToken = decryptSecret(credential.refreshTokenEncrypted);
  const token = await refreshAccessToken(refreshToken);
  return { accessToken: token.access_token, authMode: "oauth" };
}

async function runGa4Report(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GA4 API error (${response.status}): ${detail}`);
  }

  return (await response.json()) as { rows?: Ga4ReportRow[] };
}

/** Calendar day. The chart formats the weekday for the active locale. */
function formatGa4Date(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function metricNumber(rows: Ga4ReportRow[] | undefined, index = 0): number {
  return Number(rows?.[0]?.metricValues?.[index]?.value ?? 0);
}

function namedCounts(
  rows: Ga4ReportRow[] | undefined,
  metricIndex = 0
): Ga4NamedCount[] {
  return (rows ?? []).map((row) => ({
    name: row.dimensionValues?.[0]?.value || "(not set)",
    value: Number(row.metricValues?.[metricIndex]?.value ?? 0),
  }));
}

async function openGa4Report(periodInput?: string | null) {
  const period = resolveAnalyticsPeriod(periodInput);
  const source = await ensureGa4DataSource();

  if (!source.externalId) {
    throw new Error(
      "GA4 data source is missing external_id (property id). Set GA4_PROPERTY_ID."
    );
  }

  const { accessToken } = await resolveAccessToken();
  const propertyId = source.externalId.replace(/^properties\//, "");
  return { period, accessToken, propertyId };
}

export async function fetchGa4Last7Days() {
  const source = await ensureGa4DataSource();

  if (!source.externalId) {
    throw new Error(
      "GA4 data source is missing external_id (property id). Set GA4_PROPERTY_ID."
    );
  }

  const { accessToken, authMode } = await resolveAccessToken();
  const propertyId = source.externalId.replace(/^properties\//, "");

  const payload = await runGa4Report(propertyId, accessToken, {
    dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  const rows: Ga4MetricRow[] = (payload.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value ?? "",
    activeUsers: Number(row.metricValues?.[0]?.value ?? 0),
    sessions: Number(row.metricValues?.[1]?.value ?? 0),
    screenPageViews: Number(row.metricValues?.[2]?.value ?? 0),
  }));

  const totals = rows.reduce(
    (acc, row) => {
      acc.activeUsers += row.activeUsers;
      acc.sessions += row.sessions;
      acc.screenPageViews += row.screenPageViews;
      return acc;
    },
    { activeUsers: 0, sessions: 0, screenPageViews: 0 }
  );

  if (authMode === "service_account" && source.status !== "active") {
    await db
      .update(dataSources)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(dataSources.id, source.id));
  }

  return {
    propertyId,
    authMode,
    range: { startDate: "7daysAgo", endDate: "yesterday" },
    totals,
    rows,
  };
}

export async function fetchGa4Dashboard(
  periodInput?: string | null
): Promise<Ga4DashboardData> {
  const period: AnalyticsPeriod = resolveAnalyticsPeriod(periodInput);
  const source = await ensureGa4DataSource();

  if (!source.externalId) {
    throw new Error(
      "GA4 data source is missing external_id (property id). Set GA4_PROPERTY_ID."
    );
  }

  const { accessToken, authMode } = await resolveAccessToken();
  const propertyId = source.externalId.replace(/^properties\//, "");
  const dateRanges = [period.ga4];

  const [
    overview,
    daily,
    pages,
    browsers,
    operatingSystems,
    platforms,
    screenResolutions,
    conversionEvents,
  ] = await Promise.all([
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "engagedSessions" },
        { name: "screenPageViews" },
        { name: "userEngagementDuration" },
        { name: "bounceRate" },
        { name: "eventCount" },
      ],
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 8,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "browser" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 6,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "operatingSystem" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 6,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "platform" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 6,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "screenResolution" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 8,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: GA4_CONVERSION_EVENTS.map((e) => e.eventName),
          },
        },
      },
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: 20,
    }),
  ]);

  const activeUsers = metricNumber(overview.rows, 0);
  const newUsers = metricNumber(overview.rows, 1);
  const engagedSessions = metricNumber(overview.rows, 2);
  const views = metricNumber(overview.rows, 3);
  const userEngagementDuration = metricNumber(overview.rows, 4);
  const bounceRate = metricNumber(overview.rows, 5);
  const eventCount = metricNumber(overview.rows, 6);

  const countsByEvent = new Map(
    namedCounts(conversionEvents.rows).map((row) => [row.name, row.value])
  );

  const conversions: Ga4ConversionMetric[] = GA4_CONVERSION_EVENTS.map(
    (item) => ({
      eventName: item.eventName,
      label: item.label,
      count: countsByEvent.get(item.eventName) ?? 0,
    })
  );

  if (authMode === "service_account" && source.status !== "active") {
    await db
      .update(dataSources)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(dataSources.id, source.id));
  }

  return {
    live: true,
    propertyId,
    authMode,
    periodLabel: period.label,
    overview: {
      activeUsers,
      newUsers,
      engagedSessions,
      views,
      viewsPerActiveUser:
        activeUsers > 0 ? Number((views / activeUsers).toFixed(2)) : 0,
      averageEngagementSeconds:
        activeUsers > 0 ? Math.round(userEngagementDuration / activeUsers) : 0,
      bounceRate,
      eventCount,
    },
    conversions,
    traffic: (daily.rows ?? []).map((row) => ({
      day: formatGa4Date(row.dimensionValues?.[0]?.value ?? ""),
      users: Number(row.metricValues?.[0]?.value ?? 0),
    })),
    topPages: namedCounts(pages.rows),
    browsers: namedCounts(browsers.rows),
    operatingSystems: namedCounts(operatingSystems.rows),
    platforms: namedCounts(platforms.rows),
    screenResolutions: namedCounts(screenResolutions.rows),
  };
}

export async function fetchGa4PeriodComparison(periodInput?: string | null) {
  const current = resolveAnalyticsPeriod(periodInput);
  const previous = previousEquivalentRange(current.id);
  const { accessToken, propertyId } = await openGa4Report(current.id);
  const metrics = [
    { name: "activeUsers" },
    { name: "sessions" },
    { name: "screenPageViews" },
    { name: "engagementRate" },
  ];
  const [currentReport, previousReport] = await Promise.all([
    runGa4Report(propertyId, accessToken, {
      dateRanges: [current.ga4],
      metrics,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges: [previous],
      metrics,
    }),
  ]);

  const read = (rows: Ga4ReportRow[] | undefined) => ({
    activeUsers: metricNumber(rows, 0),
    sessions: metricNumber(rows, 1),
    screenPageViews: metricNumber(rows, 2),
    engagementRate: Number(metricNumber(rows, 3).toFixed(4)),
  });
  const currentMetrics = read(currentReport.rows);
  const previousMetrics = read(previousReport.rows);

  return {
    source: "Google Analytics 4" as const,
    connected: true as const,
    periodId: current.id,
    comparison: true as const,
    current: { ...current.ga4, ...currentMetrics },
    previous: { ...previous, ...previousMetrics },
    changePercent: {
      activeUsers: percentChange(currentMetrics.activeUsers, previousMetrics.activeUsers),
      sessions: percentChange(currentMetrics.sessions, previousMetrics.sessions),
      screenPageViews: percentChange(
        currentMetrics.screenPageViews,
        previousMetrics.screenPageViews
      ),
      engagementRate: percentChange(
        currentMetrics.engagementRate,
        previousMetrics.engagementRate
      ),
    },
    instruction:
      "Percent changes are computed from these two GA4 responses. Null means the previous value was 0. Do not invent a percent or any other number.",
  };
}

export async function fetchGa4TrafficSources(periodInput?: string | null) {
  const { period, accessToken, propertyId } = await openGa4Report(periodInput);
  const report = await runGa4Report(propertyId, accessToken, {
    dateRanges: [period.ga4],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 12,
  });

  return {
    source: "Google Analytics 4" as const,
    period: period.label,
    channels: (report.rows ?? []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || "(not set)",
      medium: row.dimensionValues?.[1]?.value || "(not set)",
      activeUsers: Number(row.metricValues?.[0]?.value ?? 0),
      sessions: Number(row.metricValues?.[1]?.value ?? 0),
    })),
  };
}

export async function fetchGa4Events(periodInput?: string | null) {
  const { period, accessToken, propertyId } = await openGa4Report(periodInput);
  const [topEvents, conversionEvents] = await Promise.all([
    runGa4Report(propertyId, accessToken, {
      dateRanges: [period.ga4],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit: 15,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges: [period.ga4],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: GA4_CONVERSION_EVENTS.map((event) => event.eventName),
          },
        },
      },
      limit: 20,
    }),
  ]);

  const countsByEvent = new Map(
    namedCounts(conversionEvents.rows).map((row) => [row.name, row.value])
  );

  return {
    source: "Google Analytics 4" as const,
    period: period.label,
    events: (topEvents.rows ?? []).map((row) => ({
      eventName: row.dimensionValues?.[0]?.value || "(not set)",
      eventCount: Number(row.metricValues?.[0]?.value ?? 0),
      activeUsers: Number(row.metricValues?.[1]?.value ?? 0),
    })),
    conversions: GA4_CONVERSION_EVENTS.map((event) => ({
      eventName: event.eventName,
      label: event.label,
      count: countsByEvent.get(event.eventName) ?? 0,
    })),
  };
}

export async function fetchGa4AiReferrals(
  sources: string[],
  periodInput?: string | null
) {
  const hosts = sources.map((source) => source.trim().toLowerCase()).filter(Boolean);
  const { period, accessToken, propertyId } = await openGa4Report(periodInput);
  if (hosts.length === 0) {
    return {
      source: "Google Analytics 4" as const,
      period: period.label,
      periodId: period.id,
      sessions: 0,
      activeUsers: 0,
      sources: [] as Array<{ source: string; sessions: number; activeUsers: number }>,
      queriedSources: hosts,
    };
  }

  const dimensionFilter = {
    orGroup: {
      expressions: hosts.map((host) => ({
        filter: {
          fieldName: "sessionSource",
          stringFilter: {
            matchType: "CONTAINS",
            value: host,
            caseSensitive: false,
          },
        },
      })),
    },
  };

  const [totals, breakdown] = await Promise.all([
    runGa4Report(propertyId, accessToken, {
      dateRanges: [period.ga4],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      dimensionFilter,
    }),
    runGa4Report(propertyId, accessToken, {
      dateRanges: [period.ga4],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      dimensionFilter,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 25,
    }),
  ]);

  return {
    source: "Google Analytics 4" as const,
    period: period.label,
    periodId: period.id,
    sessions: metricNumber(totals.rows, 1),
    activeUsers: metricNumber(totals.rows, 0),
    sources: (breakdown.rows ?? []).map((row) => ({
      source: row.dimensionValues?.[0]?.value || "(not set)",
      activeUsers: Number(row.metricValues?.[0]?.value ?? 0),
      sessions: Number(row.metricValues?.[1]?.value ?? 0),
    })),
    queriedSources: hosts,
  };
}
