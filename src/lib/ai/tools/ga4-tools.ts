import { getGa4ConnectionStatus } from "@/lib/analytics/ga4-source";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import {
  fetchGa4Dashboard,
  fetchGa4Events,
  fetchGa4PeriodComparison,
  fetchGa4TrafficSources,
} from "@/lib/ga4/fetch-report";

import { memoTool } from "./memo";
import { PERIOD_PARAMETER, parseToolArgs } from "./period";
import { notConnected, queryFailed, sourceUnavailable } from "./results";

const SOURCE = "Google Analytics 4";

export const ga4ToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_overview",
      description:
        "Google Analytics 4 overview for the period: active users, new users, engaged sessions, views, average engagement, bounce rate, and total events.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_pages",
      description:
        "Google Analytics 4 pages with the most screen page views in the period.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_tech_breakdown",
      description:
        "Google Analytics 4 active users by browser, operating system, platform, or screen resolution.",
      parameters: {
        type: "object",
        properties: {
          period: PERIOD_PARAMETER,
          dimension: {
            type: "string",
            enum: ["browser", "os", "platform", "resolution"],
            description: "Technology dimension to return.",
          },
        },
        required: ["dimension"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_traffic_sources",
      description:
        "Google Analytics 4 acquisition: session source and medium with active users and sessions.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_periods",
      description:
        "Compare Google Analytics 4 active users, sessions, views, and engagement rate for the selected period against the immediately previous period of the same length. Percent changes are already computed. Do not invent numbers.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_events",
      description:
        "Google Analytics 4 events and highlighted conversions (contact, sign_up, generate_lead, file_download, app_login) with event counts.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
] as const;

async function loadDashboard(period: string) {
  return memoTool(`ga4-dashboard:${period}`, 30_000, () =>
    fetchGa4Dashboard(period)
  );
}

export async function executeGa4Tool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  let connected = false;
  try {
    const status = await getGa4ConnectionStatus();
    connected = status.connected;
  } catch (error) {
    return sourceUnavailable(SOURCE, error);
  }

  if (!connected) return notConnected(SOURCE);

  const args = parseToolArgs(rawArgs);
  const period = resolveAnalyticsPeriod(args.period ?? defaultPeriod).id;

  try {
    switch (name) {
      case "get_overview": {
        const dashboard = await loadDashboard(period);
        return {
          source: SOURCE,
          connected: true,
          periodId: period,
          period: dashboard.periodLabel,
          activeUsers: dashboard.overview.activeUsers,
          newUsers: dashboard.overview.newUsers,
          engagedSessions: dashboard.overview.engagedSessions,
          views: dashboard.overview.views,
          viewsPerActiveUser: dashboard.overview.viewsPerActiveUser,
          averageEngagementSeconds: dashboard.overview.averageEngagementSeconds,
          bounceRate: dashboard.overview.bounceRate,
          eventCount: dashboard.overview.eventCount,
        };
      }
      case "get_top_pages": {
        const dashboard = await loadDashboard(period);
        return {
          source: SOURCE,
          connected: true,
          periodId: period,
          period: dashboard.periodLabel,
          pages: dashboard.topPages.slice(0, 8),
        };
      }
      case "get_tech_breakdown": {
        const dashboard = await loadDashboard(period);
        const dimension = args.dimension ?? "browser";
        const map = {
          browser: dashboard.browsers,
          os: dashboard.operatingSystems,
          platform: dashboard.platforms,
          resolution: dashboard.screenResolutions,
        } as const;
        return {
          source: SOURCE,
          connected: true,
          periodId: period,
          period: dashboard.periodLabel,
          dimension,
          items: map[dimension].slice(0, 6),
        };
      }
      case "get_traffic_sources": {
        const report = await memoTool(`ga4-sources:${period}`, 30_000, () =>
          fetchGa4TrafficSources(period)
        );
        return {
          connected: true,
          periodId: period,
          source: report.source,
          period: report.period,
          channels: report.channels.slice(0, 8),
        };
      }
      case "compare_periods":
        return memoTool(`ga4-compare:${period}`, 30_000, () =>
          fetchGa4PeriodComparison(period)
        );
      case "get_events": {
        const report = await memoTool(`ga4-events:${period}`, 30_000, () =>
          fetchGa4Events(period)
        );
        return {
          connected: true,
          periodId: period,
          source: report.source,
          period: report.period,
          events: report.events.slice(0, 8),
          conversions: report.conversions,
        };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return queryFailed(SOURCE, error);
  }
}
