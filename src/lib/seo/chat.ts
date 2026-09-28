import { redactSensitive } from "@/lib/ai/redact";

import { readSeoConfig } from "./config";
import { loadSeoWorkspace } from "./panel";
import { formatScorePoints } from "./explain";
import type { SeoWorkspace } from "./view";

const SOURCE = "PageSpeed Insights + site crawl";

export async function querySeoForChat(periodValue?: string | null) {
  const period = periodValue === "28d" || periodValue === "90d" || periodValue === "3d" || periodValue === "24h"
    ? periodValue
    : "7d";
  try {
    const workspace = await loadSeoWorkspace(period);
    return publicSummary(workspace);
  } catch (error) {
    return {
      source: SOURCE,
      connected: false as const,
      instruction: "SEO and GEO snapshots could not be read. Explain the error. Do not invent scores.",
      error: redactSensitive(error instanceof Error ? error.message : "SEO query failed", 300),
    };
  }
}

export async function loadSeoBridgeSummary() {
  return querySeoForChat("7d");
}

function publicSummary(workspace: SeoWorkspace) {
  if (!workspace.configured) {
    const config = readSeoConfig();
    return {
      source: SOURCE,
      connected: false as const,
      instruction:
        "The site URL is not configured. Tell the user to set SITE_URL. Do not invent SEO or GEO numbers.",
      error: config.ok ? null : config.detail,
    };
  }

  const findingCounts = {
    critical: workspace.openFindings.filter((item) => item.severity === "critical").length,
    warning: workspace.openFindings.filter((item) => item.severity === "warning").length,
    open: workspace.openFindings.length,
  };

  return {
    source: SOURCE,
    connected: true as const,
    siteUrl: workspace.siteUrl,
    note: "Scores are stored Lighthouse category scores from 0 to 100. Core Web Vitals use CrUX field data when the snapshot says field-url or field-origin, otherwise lab. The GEO score is points/100 on a 0 to 10 scale from the checklist rules. Finding counts are open items from the latest crawls. AI traffic is Google Analytics 4 activeUsers and sessions for the configured AI referrer hosts. Do not invent a score when a field is null.",
    pagespeed: {
      status: workspace.pagespeedStatus,
      detail: workspace.pagespeedDetail,
      updatedAt: workspace.pagespeedUpdatedAt,
      scores: workspace.scores,
    },
    crawl: workspace.crawl
      ? {
          day: workspace.crawl.day,
          pagesFetched: workspace.crawl.pagesFetched,
          pagesPlanned: workspace.crawl.pagesPlanned,
          complete: workspace.crawl.complete,
          geoScore: formatScorePoints(workspace.crawl.geoScorePoints),
          geoScorePoints: workspace.crawl.geoScorePoints,
          rules: workspace.crawl.checklist.map((rule) => ({
            id: rule.id,
            weight: formatScorePoints(rule.weightPoints),
            earned: formatScorePoints(rule.earnedPoints),
            passed: rule.passed,
            evidence: rule.evidence,
          })),
          files: {
            robotsFound: workspace.crawl.robotsFound,
            robotsBytes: workspace.crawl.robotsBytes,
            llmsFound: workspace.crawl.llmsFound,
            llmsBytes: workspace.crawl.llmsBytes,
            llmsValid: workspace.crawl.llmsValid,
            sitemapFound: workspace.crawl.sitemapFound,
            sitemapUrls: workspace.crawl.sitemapUrls,
          },
          aiBots: workspace.crawl.aiBots,
        }
      : null,
    findings: findingCounts,
    aiTraffic: workspace.aiTraffic.connected
      ? {
          source: "Google Analytics 4",
          from: workspace.aiTraffic.from,
          to: workspace.aiTraffic.to,
          sessions: workspace.aiTraffic.sessions,
          activeUsers: workspace.aiTraffic.activeUsers,
          rows: workspace.aiTraffic.rows,
          queriedSources: workspace.aiTraffic.queriedSources,
        }
      : {
          source: "Google Analytics 4",
          connected: false as const,
          error: workspace.aiTraffic.error,
          instruction: "AI referral traffic was not read from GA4. Do not invent sessions or users.",
        },
  };
}
