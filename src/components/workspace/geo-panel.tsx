"use client";

import { FreshnessBadge } from "@/components/freshness/freshness-badge";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { formatCalendarDay, formatCount } from "@/lib/i18n/format";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import { explainBot, explainGeoRule, formatScorePoints } from "@/lib/seo/explain";
import type { SeoWorkspace } from "@/lib/seo/view";

import { Disclosure } from "@/components/ui/disclosure";
import { EmptyLine } from "@/components/ui/empty-line";
import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard } from "@/components/ui/kpi-card";

import { SeoCollectButton } from "./seo-collect-button";
import { FindingsSection } from "./seo-panel";

type Copy = (key: WorkspaceMessageKey) => string;

export function GeoPanel({ locale, data }: { locale: ChatLocale; data: SeoWorkspace }) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  if (!data.configured) {
    return (
      <div className="space-y-4">
        <FreshnessBadge
          cadence="snapshot"
          observedAt={data.crawlUpdatedAt}
          ok={false}
          locale={locale}
        />
        <EmptyLine
          title={text("geoHeading")}
          detail={
            data.detail === "invalid_site_url"
              ? text("seoInvalidSite")
              : !data.detail || data.detail === "missing_site_url"
                ? text("seoMissingSite")
                : data.detail
          }
        />
      </div>
    );
  }

  const crawl = data.crawl;
  return (
    <div className="space-y-6">
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="truncate text-sm font-medium text-foreground">{text("geoHeading")}</h3>
        <FreshnessBadge
          cadence="snapshot"
          observedAt={data.crawlUpdatedAt}
          ok={data.crawlStatus === "active"}
          locale={locale}
        />
        <InfoTip text={text("geoIntro")} />
      </header>

      <KpiCard
        label={text("geoScore")}
        value={crawl ? `${formatScorePoints(crawl.geoScorePoints)} / 10` : "—"}
        citation={
          crawl
            ? `${text("seoSourceCrawl")} · ${crawl.siteUrl} · ${formatDay(crawl.day, locale)}`
            : text("geoNoScore")
        }
      />

      <AiTrafficCard locale={locale} data={data} text={text} />

      {crawl ? (
        <Disclosure title={text("geoHowScored")}>
          <ul>
            {crawl.checklist.map((rule) => {
              const state = rule.passed
                ? text("geoPassed")
                : rule.earnedPoints > 0
                  ? text("geoPartial")
                  : text("geoFailed");
              return (
                <li key={rule.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-foreground">{ruleName(locale, rule.id)}</p>
                      <InfoTip
                        text={`${explainGeoRule(locale, rule)} ${text("geoWeight")} ${formatScorePoints(rule.weightPoints)} · ${text("geoEarned")} ${formatScorePoints(rule.earnedPoints)}`}
                      />
                    </div>
                    <p className="text-xs text-muted">{state}</p>
                  </div>
                  <p className="font-display text-lg font-semibold tabular-nums text-accent">
                    {formatScorePoints(rule.earnedPoints)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Disclosure>
      ) : (
        <p className="text-sm text-muted">{text("geoNoScore")}</p>
      )}

      <Disclosure title={text("technicalDetails")}>
        {data.crawlStatus === "error" && data.crawlDetail ? (
          <EmptyLine title={text("statusError")} detail={data.crawlDetail} />
        ) : null}

        {crawl ? (
          <section className="space-y-2">
            <div className="flex items-center gap-1">
              <h4 className="text-sm font-medium text-foreground">{text("geoFiles")}</h4>
              <InfoTip text={`${text("seoSourceCrawl")} · ${formatDay(crawl.day, locale)}`} />
            </div>
            <FileRow
              name="robots.txt"
              found={crawl.robotsFound}
              bytes={crawl.robotsBytes}
              text={text}
            />
            <FileRow name="llms.txt" found={crawl.llmsFound} bytes={crawl.llmsBytes} text={text} />
            <FileRow
              name="sitemap.xml"
              found={crawl.sitemapFound}
              bytes={null}
              extra={crawl.sitemapFound ? String(crawl.sitemapUrls) : null}
              text={text}
            />
          </section>
        ) : null}

        {crawl ? (
          <section>
            <h4 className="text-sm font-medium text-foreground">{text("geoAiBots")}</h4>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {crawl.aiBots.map((bot) => (
                <li key={bot.bot}>{explainBot(locale, bot)}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <SeoCollectButton
          label={text("seoCollect")}
          pendingLabel={text("seoCollecting")}
          doneLabel={text("seoCollected")}
          failedLabel={text("seoCollectFailed")}
        />
      </Disclosure>

      <FindingsSection locale={locale} data={data} source="geo" />
    </div>
  );
}

function AiTrafficCard({
  locale,
  data,
  text,
}: {
  locale: ChatLocale;
  data: SeoWorkspace;
  text: Copy;
}) {
  const traffic = data.aiTraffic;
  const citation = [
    text("geoAiTrafficBody"),
    "GA4",
    traffic.from && traffic.to
      ? `${formatDay(traffic.from, locale)}–${formatDay(traffic.to, locale)}`
      : null,
    traffic.queriedSources.length > 0
      ? `${text("geoHosts")}: ${traffic.queriedSources.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1">
        <h4 className="text-sm font-medium text-foreground">{text("geoAiTraffic")}</h4>
        <InfoTip text={citation} />
      </div>
      {traffic.connected && traffic.sessions != null && traffic.activeUsers != null ? (
        <div className="grid grid-cols-2 gap-1">
          <KpiCard
            label={text("geoSessions")}
            value={formatNumber(traffic.sessions, locale)}
            citation={citation}
          />
          <KpiCard
            label={text("geoUsers")}
            value={formatNumber(traffic.activeUsers, locale)}
            citation={citation}
          />
        </div>
      ) : (
        <p className="text-sm text-muted">{traffic.error || text("geoAiDisconnected")}</p>
      )}
      {traffic.rows.length > 0 ? (
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">{text("actionsSource")}</th>
              <th className="py-1 pr-2 font-medium">{text("geoSessions")}</th>
              <th className="py-1 font-medium">{text("geoUsers")}</th>
            </tr>
          </thead>
          <tbody>
            {traffic.rows.map((row) => (
              <tr key={row.source} className="border-t border-border">
                <td className="py-1 pr-2">{row.source}</td>
                <td className="py-1 pr-2">{formatNumber(row.sessions, locale)}</td>
                <td className="py-1">{formatNumber(row.activeUsers, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function FileRow({
  name,
  found,
  bytes,
  extra,
  text,
}: {
  name: string;
  found: boolean;
  bytes: number | null;
  extra?: string | null;
  text: Copy;
}) {
  return (
    <p className="text-sm text-foreground">
      {name} · {found ? text("geoFound") : text("geoAbsent")}
      {found && bytes != null ? ` · ${bytes} ${text("geoBytes")}` : ""}
      {extra ? ` · ${extra}` : ""}
    </p>
  );
}

const GEO_RULE_KEYS: Record<string, WorkspaceMessageKey> = {
  llms_present: "geoRuleLlmsPresent",
  llms_valid: "geoRuleLlmsValid",
  robots_ai: "geoRuleRobotsAi",
  jsonld_organization: "geoRuleJsonldOrg",
  jsonld_website: "geoRuleJsonldWebsite",
  jsonld_product: "geoRuleJsonldProduct",
  jsonld_faq: "geoRuleJsonldFaq",
  headings: "geoRuleHeadings",
  readability: "geoRuleReadability",
};

function ruleName(locale: ChatLocale, id: string): string {
  const key = GEO_RULE_KEYS[id];
  return key ? workspaceText(locale, key) : id;
}

function formatNumber(value: number, locale: ChatLocale): string {
  return formatCount(value, locale);
}

function formatDay(value: string, locale: ChatLocale): string {
  return formatCalendarDay(value, locale);
}
