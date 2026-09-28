import { readSeoConfig } from "@/lib/seo/config";
import { querySeoForChat } from "@/lib/seo/chat";

import { PERIOD_PARAMETER, parseToolArgs } from "./period";
import { notConnected, queryFailed } from "./results";

const SOURCE = "PageSpeed Insights + site crawl";

export const seoToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_seo_overview",
      description:
        "Stored PageSpeed Insights scores (performance, accessibility, best practices, SEO) for mobile and desktop, Core Web Vitals with field or lab origin, and open SEO/GEO finding counts. Null means that measurement was not stored. Do not invent scores.",
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
      name: "get_geo_overview",
      description:
        "GEO checklist score from 0 to 10, each rule's weight and evidence, and GA4 sessions plus active users from configured AI referrers. Use only returned numbers.",
      parameters: {
        type: "object",
        properties: { period: PERIOD_PARAMETER },
        additionalProperties: false,
      },
    },
  },
] as const;

export async function executeSeoTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  if (!readSeoConfig().ok) return notConnected(SOURCE);
  const args = parseToolArgs(rawArgs);
  const period = args.period ?? defaultPeriod;
  try {
    const summary = await querySeoForChat(period);
    if (!summary.connected) return summary;
    if (name === "get_seo_overview") {
      return {
        source: SOURCE,
        connected: true,
        siteUrl: summary.siteUrl,
        note: summary.note,
        pagespeed: summary.pagespeed,
        findings: summary.findings,
        crawlDay: summary.crawl?.day ?? null,
      };
    }
    if (name === "get_geo_overview") {
      return {
        source: SOURCE,
        connected: true,
        siteUrl: summary.siteUrl,
        note: summary.note,
        crawl: summary.crawl,
        findings: summary.findings,
        aiTraffic: summary.aiTraffic,
      };
    }
    return { error: `Unknown tool: ${name}`, instruction: "Do not invent metrics." };
  } catch (error) {
    return queryFailed(SOURCE, error);
  }
}
