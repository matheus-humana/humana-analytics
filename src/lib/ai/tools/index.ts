import { executeContextTool, contextToolDefinitions } from "./context-tools";
import { executeGa4Tool, ga4ToolDefinitions } from "./ga4-tools";
import { executeGithubTool, githubToolDefinitions } from "./github-tools";
import { executeSeoTool, seoToolDefinitions } from "./seo-tools";
import { executeWebTool, webToolDefinitions } from "./web-tools";
import { prepareToolResult } from "../tool-trace";

export const analyticsToolDefinitions = [
  ...ga4ToolDefinitions,
  ...githubToolDefinitions,
  ...seoToolDefinitions,
  ...contextToolDefinitions,
];

export function chatToolDefinitions(options: { web?: boolean }) {
  return options.web
    ? [...analyticsToolDefinitions, ...webToolDefinitions]
    : [...analyticsToolDefinitions];
}

export type ChatToolDefinition = ReturnType<typeof chatToolDefinitions>[number];

export type ToolRunContext = {
  projectId: string | null;
};

// Clarity and Vercel clients were removed. These names stay refused so a
// model cannot treat them as traffic sources.
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
  "compare_periods",
]);

export async function executeAnalyticsTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string,
  toolContext?: ToolRunContext
): Promise<unknown> {
  const retrievedAt = new Date().toISOString();
  let result: unknown;
  if (DISABLED_TOOLS.has(name)) {
    result = {
      source: "Google Analytics 4",
      connected: false,
      error: "This source is disabled.",
      instruction:
        "Microsoft Clarity and Vercel Analytics are not traffic sources. Use Google Analytics 4. Do not invent metrics.",
    };
  } else if (name === "get_project_context") {
    result = await executeContextTool(toolContext?.projectId ?? null);
  } else if (GA4_TOOLS.has(name)) {
    result = await executeGa4Tool(name, rawArgs, defaultPeriod);
  } else if (GITHUB_TOOLS.has(name)) {
    result = await executeGithubTool(name, rawArgs, defaultPeriod);
  } else if (SEO_TOOLS.has(name)) {
    result = await executeSeoTool(name, rawArgs, defaultPeriod);
  } else if (name === "search_web") {
    result = await executeWebTool(rawArgs);
  } else {
    result = {
      source: "unknown",
      error: `Unknown tool: ${name}`,
      instruction: "Do not invent metrics.",
    };
  }
  return prepareToolResult(result, retrievedAt);
}
