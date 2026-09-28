import { executeGa4Tool, ga4ToolDefinitions } from "./ga4-tools";
import { executeGithubTool, githubToolDefinitions } from "./github-tools";
import { executeSeoTool, seoToolDefinitions } from "./seo-tools";

export const analyticsToolDefinitions = [
  ...ga4ToolDefinitions,
  ...githubToolDefinitions,
  ...seoToolDefinitions,
];

const DISABLED_TOOLS = new Set([
  "get_clarity_overview",
  "get_clarity_friction",
  "get_vercel_overview",
  "get_vercel_sources",
]);

const GITHUB_TOOLS = new Set([
  "get_github_overview",
  "get_github_traffic",
  "get_github_referrers",
  "get_github_downloads",
]);

const SEO_TOOLS = new Set(["get_seo_overview", "get_geo_overview"]);

const GA4_TOOLS = new Set([
  "get_overview",
  "get_top_pages",
  "get_tech_breakdown",
  "get_traffic_sources",
  "get_events",
]);

export async function executeAnalyticsTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  if (DISABLED_TOOLS.has(name)) {
    return {
      connected: false,
      error: "This source is disabled.",
      instruction:
        "Microsoft Clarity and Vercel Analytics are not traffic sources. Use Google Analytics 4. Do not invent metrics.",
    };
  }
  if (GA4_TOOLS.has(name)) {
    return executeGa4Tool(name, rawArgs, defaultPeriod);
  }
  if (GITHUB_TOOLS.has(name)) {
    return executeGithubTool(name, rawArgs, defaultPeriod);
  }
  if (SEO_TOOLS.has(name)) {
    return executeSeoTool(name, rawArgs, defaultPeriod);
  }
  return {
    error: `Unknown tool: ${name}`,
    instruction: "Do not invent metrics.",
  };
}
