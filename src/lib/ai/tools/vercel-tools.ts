/**
 * Not registered with the analytics agent. Vercel Web Analytics is not a product source.
 * The module stays so the integration can be restored without rewriting it.
 */
import { hasVercelCredentials } from "@/lib/analytics/vercel-source";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { fetchVercelDashboard } from "@/lib/vercel/fetch-report";

import { memoTool } from "./memo";
import { PERIOD_PARAMETER, parseToolArgs } from "./period";
import { notConnected, queryFailed } from "./results";

const SOURCE = "Vercel Analytics";

export const vercelToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_vercel_overview",
      description:
        "Vercel Web Analytics overview: visitors and pageviews for the period.",
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
      name: "get_vercel_sources",
      description:
        "Vercel Web Analytics traffic sources: referrer hostnames with their recorded values (pageviews when available).",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
] as const;

async function loadVercel(period: string) {
  return memoTool(`vercel:${period}`, 30_000, () =>
    fetchVercelDashboard({ period })
  );
}

export async function executeVercelTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  if (!hasVercelCredentials()) return notConnected(SOURCE);

  const args = parseToolArgs(rawArgs);
  const period = resolveAnalyticsPeriod(args.period ?? defaultPeriod).id;

  try {
    const report = await loadVercel(period);
    const shared = {
      source: SOURCE,
      connected: true as const,
      period: report.periodLabel,
      since: report.since,
      until: report.until,
    };

    if (name === "get_vercel_overview") {
      return {
        ...shared,
        visitors: report.overview.visitors,
        pageviews: report.overview.pageviews,
      };
    }

    if (name === "get_vercel_sources") {
      return {
        ...shared,
        referrers: report.referrers,
        valueMeaning:
          "Each value is pageviews when the API returned them, otherwise visitors.",
      };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (error) {
    return queryFailed(SOURCE, error);
  }
}
