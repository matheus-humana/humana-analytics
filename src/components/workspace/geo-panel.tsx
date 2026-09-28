"use client";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import { explainBot, explainGeoRule, formatScorePoints } from "@/lib/seo/explain";
import type { SeoWorkspace } from "@/lib/seo/view";

import { SeoCollectButton } from "./seo-collect-button";

type Copy = (key: WorkspaceMessageKey) => string;

export function GeoPanel({ locale, data }: { locale: ChatLocale; data: SeoWorkspace }) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  if (!data.configured) {
    return (
      <Notice
        title={text("geoHeading")}
        body={
          data.detail === "invalid_site_url"
            ? text("seoInvalidSite")
            : !data.detail || data.detail === "missing_site_url"
              ? text("seoMissingSite")
              : data.detail
        }
      />
    );
  }

  const crawl = data.crawl;
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h3 className="font-display text-base font-semibold text-foreground">{text("geoHeading")}</h3>
        <p className="text-sm leading-relaxed text-muted">{text("geoIntro")}</p>
        <SeoCollectButton
          label={text("seoCollect")}
          pendingLabel={text("seoCollecting")}
          doneLabel={text("seoCollected")}
          failedLabel={text("seoCollectFailed")}
        />
      </header>

      {data.crawlStatus === "error" && data.crawlDetail ? (
        <Notice title={text("statusError")} body={data.crawlDetail} />
      ) : null}

      <section className="rounded-xl border border-border p-3">
        <p className="text-xs uppercase tracking-wide text-muted">{text("geoScore")}</p>
        <p className="mt-1 font-display text-3xl font-semibold text-foreground">
          {crawl ? formatScorePoints(crawl.geoScorePoints) : "—"}
          <span className="text-base font-medium text-muted"> / 10</span>
        </p>
        <p className="mt-1 text-xs text-muted">
          {crawl
            ? `${text("seoSourceCrawl")} · ${formatDay(crawl.day, locale)}`
            : text("geoNoScore")}
        </p>
      </section>

      {crawl ? (
        <ul className="space-y-2">
          {crawl.checklist.map((rule) => {
            const state = rule.passed
              ? text("geoPassed")
              : rule.earnedPoints > 0
                ? text("geoPartial")
                : text("geoFailed");
            return (
              <li key={rule.id} className="rounded-xl border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{ruleName(locale, rule.id)}</p>
                  <span className="text-xs text-muted">{state}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {text("geoWeight")} {formatScorePoints(rule.weightPoints)} · {text("geoEarned")}{" "}
                  {formatScorePoints(rule.earnedPoints)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-foreground">
                  {explainGeoRule(locale, rule)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">{text("geoNoScore")}</p>
      )}

      {crawl ? (
        <section className="space-y-2">
          <h4 className="font-display text-sm font-semibold text-foreground">{text("geoFiles")}</h4>
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
          <p className="text-xs text-muted">
            {text("seoSourceCrawl")} · {formatDay(crawl.day, locale)}
          </p>
        </section>
      ) : null}

      {crawl ? (
        <section>
          <h4 className="font-display text-sm font-semibold text-foreground">{text("geoAiBots")}</h4>
          <ul className="mt-2 space-y-1 text-xs text-foreground">
            {crawl.aiBots.map((bot) => (
              <li key={bot.bot}>{explainBot(locale, bot)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <AiTrafficCard locale={locale} data={data} text={text} />
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
  return (
    <section className="rounded-xl border border-border p-3">
      <h4 className="font-display text-sm font-semibold text-foreground">{text("geoAiTraffic")}</h4>
      <p className="mt-1 text-xs leading-relaxed text-muted">{text("geoAiTrafficBody")}</p>
      {traffic.connected && traffic.sessions != null && traffic.activeUsers != null ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Metric label={text("geoSessions")} value={formatNumber(traffic.sessions, locale)} />
          <Metric label={text("geoUsers")} value={formatNumber(traffic.activeUsers, locale)} />
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{traffic.error || text("geoAiDisconnected")}</p>
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
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        GA4
        {traffic.from && traffic.to
          ? ` · ${formatDay(traffic.from, locale)}–${formatDay(traffic.to, locale)}`
          : ""}
        {traffic.queriedSources.length > 0
          ? ` · ${text("geoHosts")}: ${traffic.queriedSources.join(", ")}`
          : ""}
      </p>
    </section>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-[#f8f8f8] px-4 py-5">
      <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ruleName(locale: ChatLocale, id: string): string {
  const names: Record<string, { "pt-BR": string; en: string }> = {
    llms_present: { "pt-BR": "/llms.txt existe", en: "/llms.txt exists" },
    llms_valid: { "pt-BR": "/llms.txt válido", en: "/llms.txt is valid" },
    robots_ai: { "pt-BR": "Robôs de IA liberados", en: "AI crawlers allowed" },
    jsonld_organization: { "pt-BR": "JSON-LD Organization", en: "JSON-LD Organization" },
    jsonld_website: { "pt-BR": "JSON-LD WebSite", en: "JSON-LD WebSite" },
    jsonld_product: { "pt-BR": "JSON-LD Product ou SoftwareApplication", en: "JSON-LD Product or SoftwareApplication" },
    jsonld_faq: { "pt-BR": "JSON-LD FAQPage", en: "JSON-LD FAQPage" },
    headings: { "pt-BR": "Estrutura de títulos", en: "Heading structure" },
    readability: { "pt-BR": "Legibilidade do texto principal", en: "Main-text readability" },
  };
  return names[id]?.[locale] ?? id;
}

function formatNumber(value: number, locale: ChatLocale): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR").format(value);
}

function formatDay(value: string, locale: ChatLocale): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
