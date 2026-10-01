export type ThinkingSource = "ga4" | "github" | "seo" | "geo" | "web";

const TOOL_SOURCES: Record<string, ThinkingSource> = {
  get_overview: "ga4",
  get_top_pages: "ga4",
  get_tech_breakdown: "ga4",
  get_traffic_sources: "ga4",
  get_events: "ga4",
  get_github_overview: "github",
  get_github_traffic: "github",
  get_github_referrers: "github",
  get_github_downloads: "github",
  get_seo_overview: "seo",
  get_geo_overview: "geo",
  search_web: "web",
};

/** Data sources behind a tool round, in call order and without repeats. */
export function toolSources(tools: readonly string[]): ThinkingSource[] {
  const sources: ThinkingSource[] = [];
  for (const tool of tools) {
    const source = TOOL_SOURCES[tool];
    if (source && !sources.includes(source)) sources.push(source);
  }
  return sources;
}
