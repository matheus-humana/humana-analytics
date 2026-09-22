import { hasClarityCredentials } from "@/lib/analytics/clarity-source";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { fetchClarityLiveInsights } from "@/lib/clarity/fetch-report";

import { memoTool } from "./memo";
import { PERIOD_PARAMETER, parseToolArgs } from "./period";
import { notConnected, queryFailed } from "./results";

const SOURCE = "Microsoft Clarity";

export const clarityToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_clarity_overview",
      description:
        "Microsoft Clarity overview: unique users, sessions, bot sessions, pages per session, scroll depth, and active time. Clarity only covers 1–3 days.",
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
      name: "get_clarity_friction",
      description:
        "Microsoft Clarity friction: rage clicks, dead clicks, excessive scroll, quickbacks, error clicks, and script errors. Clarity only covers 1–3 days.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
] as const;

async function loadClarity(period: string) {
  return memoTool(`clarity:${period}`, 60_000, () =>
    fetchClarityLiveInsights({ period })
  );
}

export async function executeClarityTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  if (!hasClarityCredentials()) return notConnected(SOURCE);

  const args = parseToolArgs(rawArgs);
  const period = resolveAnalyticsPeriod(args.period ?? defaultPeriod).id;

  try {
    const report = await loadClarity(period);
    const shared = {
      source: SOURCE,
      connected: true as const,
      period: report.periodLabel,
      numOfDays: report.numOfDays,
      periodClamped: report.periodClamped,
    };

    if (name === "get_clarity_overview") {
      return {
        ...shared,
        users: report.users,
        behavior: report.behavior,
      };
    }

    if (name === "get_clarity_friction") {
      return {
        ...shared,
        interactions: report.interactions,
      };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (error) {
    return queryFailed(SOURCE, error);
  }
}
