import { clarityToolDefinitions, executeClarityTool } from "./clarity-tools";
import { executeGa4Tool, ga4ToolDefinitions } from "./ga4-tools";
import { executeGithubTool, githubToolDefinitions } from "./github-tools";
import { executeSeoTool, seoToolDefinitions } from "./seo-tools";
import { executeVercelTool, vercelToolDefinitions } from "./vercel-tools";

export const analyticsToolDefinitions = [
  ...ga4ToolDefinitions,
  ...clarityToolDefinitions,
  ...vercelToolDefinitions,
  ...githubToolDefinitions,
  ...seoToolDefinitions,
];

const CLARITY_TOOLS = new Set([
  "get_clarity_overview",
  "get_clarity_friction",
]);

const VERCEL_TOOLS = new Set(["get_vercel_overview", "get_vercel_sources"]);

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
  if (GA4_TOOLS.has(name)) {
    return executeGa4Tool(name, rawArgs, defaultPeriod);
  }
  if (CLARITY_TOOLS.has(name)) {
    return executeClarityTool(name, rawArgs, defaultPeriod);
  }
  if (VERCEL_TOOLS.has(name)) {
    return executeVercelTool(name, rawArgs, defaultPeriod);
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
