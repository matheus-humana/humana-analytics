"use client";

import { useState } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import { explainFinding, explainVitalOrigin } from "@/lib/seo/explain";
import type { FindingGroup } from "@/lib/seo/groups";
import type { FindingView, ScoreCard, SeoWorkspace } from "@/lib/seo/view";
import type { VitalOrigin } from "@/lib/seo/types";

import { EmptyLine } from "@/components/ui/empty-line";
import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard } from "@/components/ui/kpi-card";

import { SeoCollectButton } from "./seo-collect-button";

type Copy = (key: WorkspaceMessageKey) => string;

export function SeoPanel({ locale, data }: { locale: ChatLocale; data: SeoWorkspace }) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const pages = pageChoices(data);
  const [pageUrl, setPageUrl] = useState(pages[0] ?? data.siteUrl ?? "");
  const selected = pageUrl || pages[0] || "";
  const mobile = data.scores.find((score) => score.pageUrl === selected && score.strategy === "mobile") ?? null;
  const desktop = data.scores.find((score) => score.pageUrl === selected && score.strategy === "desktop") ?? null;
  const health = data.pageHealth.find((page) => page.pageUrl === selected) ?? null;
  const series = data.series.filter((point) => point.pageUrl === selected);
  const problems = data.openFindings.filter((item) => item.source === "seo");

  if (!data.configured) {
    return (
      <EmptyLine title={text("seoHeading")} detail={configMessage(data.detail, text)} />
    );
  }

  const sourceLine = [text("seoIntro"), data.siteUrl].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h3 className="truncate text-sm font-medium text-foreground">{text("seoHeading")}</h3>
          <InfoTip text={sourceLine} />
        </div>
        <SeoCollectButton
          label={text("seoCollect")}
          pendingLabel={text("seoCollecting")}
          doneLabel={text("seoCollected")}
          failedLabel={text("seoCollectFailed")}
        />
      </header>

      {data.pagespeedStatus === "error" && data.pagespeedDetail ? (
        <EmptyLine title={text("statusError")} detail={data.pagespeedDetail} />
      ) : null}
      {data.crawlStatus === "error" && data.crawlDetail ? (
        <EmptyLine title={text("statusError")} detail={data.crawlDetail} />
      ) : null}

      {pages.length > 1 ? (
        <label className="block text-xs text-muted">
          {text("seoPage")}
          <select
            value={selected}
            onChange={(event) => setPageUrl(event.target.value)}
            className="mt-1 w-full rounded-lg border border-secondary bg-surface px-2 py-1.5 text-sm text-foreground"
          >
            {pages.map((url) => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="space-y-4">
        {mobile ? (
          <StrategyScores
            locale={locale}
            title={text("seoMobile")}
            strategy="mobile"
            score={mobile}
            text={text}
            series={series}
          />
        ) : null}
        {desktop ? (
          <StrategyScores
            locale={locale}
            title={text("seoDesktop")}
            strategy="desktop"
            score={desktop}
            text={text}
            series={series}
          />
        ) : null}
        {!mobile && !desktop ? (
          <p className="text-sm text-muted">{text("seoNoPagespeed")}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">{text("seoCwv")}</h4>
        <VitalRow locale={locale} label={text("seoMobile")} score={mobile} text={text} />
        <VitalRow locale={locale} label={text("seoDesktop")} score={desktop} text={text} />
      </section>

      {series.length > 0 ? (
        <section>
          <div className="flex items-center gap-1">
            <h4 className="text-sm font-medium text-foreground">{text("seoSeries")}</h4>
            <InfoTip
              text={`${formatDay(data.periodFrom, locale)}–${formatDay(data.periodTo, locale)}`}
            />
          </div>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-2 font-medium">{text("githubDay")}</th>
                <th className="py-1 pr-2 font-medium">{text("seoMobile")}</th>
                <th className="py-1 font-medium">{text("seoDesktop")}</th>
              </tr>
            </thead>
            <tbody>
              {seriesDays(series).map((day) => (
                <tr key={day} className="border-t border-border">
                  <td className="py-1 pr-2">{formatDay(day, locale)}</td>
                  <td className="py-1 pr-2">{seriesCell(series, day, "mobile")}</td>
                  <td className="py-1">{seriesCell(series, day, "desktop")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section>
        <div className="flex items-center gap-1">
          <h4 className="text-sm font-medium text-foreground">{text("seoPageHealth")}</h4>
          {data.crawl ? (
            <InfoTip
              text={`${text("seoSourceCrawl")} · ${formatDay(data.crawl.day, locale)}${
                data.crawl.complete
                  ? ""
                  : ` · ${text("seoPartial")} ${data.crawl.pagesFetched}/${data.crawl.pagesPlanned}`
              }`}
            />
          ) : null}
        </div>
        {health ? (
          <dl className="mt-2 space-y-1 text-sm">
            <Health label={text("seoHttp")} value={String(health.httpStatus)} />
            <Health label={text("seoTitle")} value={health.title ? `${health.titleLength}` : "—"} />
            <Health
              label={text("seoDescription")}
              value={health.description ? `${health.descriptionLength}` : "—"}
            />
            <Health label={text("seoH1")} value={String(health.h1Count)} />
            <Health label={text("seoCanonical")} value={health.canonical ?? "—"} />
            <Health label={text("seoLang")} value={health.lang ?? "—"} />
            <Health
              label={text("seoHreflang")}
              value={health.hreflang.map((link) => link.lang).filter(Boolean).join(", ") || "—"}
            />
            <Health label={text("seoImagesAlt")} value={String(health.imagesMissingAlt)} />
            <Health label={text("seoNoindex")} value={health.noindex ? "noindex" : "—"} />
            <Health label={text("seoJsonLd")} value={health.jsonLdTypes.join(", ") || "—"} />
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">{text("seoNoCrawl")}</p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">{text("seoProblems")}</h4>
        {problems.length === 0 ? (
          <p className="text-sm text-muted">
            {data.crawl ? text("seoNoProblems") : text("seoNoCrawl")}
          </p>
        ) : (
          problems.map((item) => <FindingCard key={item.fingerprint} locale={locale} item={item} text={text} />)
        )}
      </section>

      <EmptyLine title={text("seoSearchConsoleTitle")} detail={text("seoSearchConsoleBody")} />
    </div>
  );
}

export function FindingGroupCard({
  locale,
  group,
  text,
}: {
  locale: ChatLocale;
  group: FindingGroup;
  text: Copy;
}) {
  const copy = explainFinding(locale, group.code);
  const countLabel =
    group.count === 1
      ? text("actionsOnePage")
      : `${group.count} ${text("actionsPages")}`;
  const meta = `${group.source === "geo" ? "GEO" : "SEO"} · ${formatDay(group.lastSeenOn, locale)}`;
  return (
    <article className="py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground">{copy?.title ?? group.code}</p>
        <span className="shrink-0 text-xs text-muted">
          {group.severity === "critical" ? text("seoCritical") : text("seoWarning")}
        </span>
      </div>
      <div className="mt-1 flex items-start gap-1">
        <p className="text-xs text-muted">{copy?.fix}</p>
        <InfoTip text={meta} />
      </div>
      {group.detail ? (
        <p className="mt-1 text-xs text-foreground">{findingDetail(group.code, group.detail, text)}</p>
      ) : null}
      <p className="mt-2 text-sm font-medium tabular-nums text-accent">{countLabel}</p>
      <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-xs text-muted">
        {group.pages.map((page) => (
          <li key={`${page.url}:${page.detail}`}>
            {page.url}
            {group.detail == null && page.detail
              ? ` · ${findingDetail(group.code, page.detail, text)}`
              : ""}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function FindingCard({
  locale,
  item,
  text,
}: {
  locale: ChatLocale;
  item: FindingView;
  text: Copy;
}) {
  const copy = explainFinding(locale, item.code);
  const meta = `${item.source === "geo" ? "GEO" : "SEO"} · ${item.pageUrl} · ${formatDay(item.lastSeenOn, locale)}`;
  return (
    <article className="py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground">{copy?.title ?? item.code}</p>
        <span className="shrink-0 text-xs text-muted">
          {item.severity === "critical" ? text("seoCritical") : text("seoWarning")}
        </span>
      </div>
      <div className="mt-1 flex items-start gap-1">
        <p className="text-xs text-muted">{copy?.fix}</p>
        <InfoTip text={item.detail ? `${item.detail} · ${meta}` : meta} />
      </div>
    </article>
  );
}

function findingDetail(code: string, detail: string, text: Copy): string {
  if (code !== "geo_js_only") return detail;
  if (detail === "h1,text") return text("actionsJsBoth");
  if (detail === "text") return text("actionsJsText");
  if (detail === "h1") return text("actionsJsH1");
  return detail;
}

function StrategyScores({
  locale,
  title,
  strategy,
  score,
  text,
  series,
}: {
  locale: ChatLocale;
  title: string;
  strategy: "mobile" | "desktop";
  score: ScoreCard | null;
  text: Copy;
  series: SeoWorkspace["series"];
}) {
  const citation = score
    ? `${text("seoSourcePagespeed")} · ${score.pageUrl} · ${formatDay(score.day, locale)}`
    : text("seoNoPagespeed");
  return (
    <div>
      <h4 className="mb-1 text-xs text-muted">{title}</h4>
      <div className="grid grid-cols-2 gap-1">
        <KpiCard
          label={`${text("seoPerformance")} · ${title}`}
          value={score?.performance == null ? "—" : String(score.performance)}
          citation={citation}
          series={metricSeries(series, strategy, "performance")}
        />
        <KpiCard
          label={`${text("seoAccessibility")} · ${title}`}
          value={score?.accessibility == null ? "—" : String(score.accessibility)}
          citation={citation}
        />
        <KpiCard
          label={`${text("seoBestPractices")} · ${title}`}
          value={score?.bestPractices == null ? "—" : String(score.bestPractices)}
          citation={citation}
        />
        <KpiCard
          label={`${text("seoSeo")} · ${title}`}
          value={score?.seo == null ? "—" : String(score.seo)}
          citation={citation}
          series={metricSeries(series, strategy, "seo")}
        />
      </div>
    </div>
  );
}

function metricSeries(
  series: SeoWorkspace["series"],
  strategy: "mobile" | "desktop",
  key: "performance" | "seo"
): Array<number | null> {
  return series
    .filter((point) => point.strategy === strategy)
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((point) => point[key]);
}

function VitalRow({
  locale,
  label,
  score,
  text,
}: {
  locale: ChatLocale;
  label: string;
  score: ScoreCard | null;
  text: Copy;
}) {
  if (!score) return null;
  return (
    <div className="grid grid-cols-3 gap-1">
      <Vital
        locale={locale}
        name={`${text("seoLcp")} · ${label}`}
        value={formatMs(score.lcpMs)}
        origin={score.lcpOrigin}
        rating={rate("lcp", score.lcpMs)}
        text={text}
        source={`${text("seoSourcePagespeed")} · ${formatDay(score.day, locale)}`}
      />
      <Vital
        locale={locale}
        name={`${text("seoCls")} · ${label}`}
        value={formatCls(score.clsThousandths)}
        origin={score.clsOrigin}
        rating={rate("cls", score.clsThousandths)}
        text={text}
        source={`${text("seoSourcePagespeed")} · ${formatDay(score.day, locale)}`}
      />
      <Vital
        locale={locale}
        name={`${text("seoInp")} · ${label}`}
        value={formatMs(score.inpMs)}
        origin={score.inpOrigin}
        rating={rate("inp", score.inpMs)}
        text={text}
        source={`${text("seoSourcePagespeed")} · ${formatDay(score.day, locale)}`}
      />
    </div>
  );
}

function Vital({
  locale,
  name,
  value,
  origin,
  rating,
  text,
  source,
}: {
  locale: ChatLocale;
  name: string;
  value: string | null;
  origin: VitalOrigin | null;
  rating: "good" | "ni" | "poor" | null;
  text: Copy;
  source: string;
}) {
  const ratingLabel =
    rating === "good" ? text("seoGood") : rating === "ni" ? text("seoNeedsImprovement") : rating === "poor" ? text("seoPoor") : null;
  const citation = [source, ratingLabel, origin ? explainVitalOrigin(locale, origin) : null]
    .filter(Boolean)
    .join(" · ");
  return <KpiCard label={name} value={value ?? "—"} citation={citation} />;
}

function Health({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-border py-1 first:border-t-0">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

function pageChoices(data: SeoWorkspace): string[] {
  const urls = new Set<string>();
  if (data.siteUrl) urls.add(data.siteUrl);
  for (const score of data.scores) urls.add(score.pageUrl);
  for (const page of data.pageHealth) urls.add(page.pageUrl);
  return [...urls];
}

function seriesDays(series: SeoWorkspace["series"]): string[] {
  return [...new Set(series.map((point) => point.day))].sort();
}

function seriesCell(
  series: SeoWorkspace["series"],
  day: string,
  strategy: "mobile" | "desktop"
): string {
  const point = series.find((item) => item.day === day && item.strategy === strategy);
  if (!point || point.performance == null) return "—";
  return String(point.performance);
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

function configMessage(detail: string | null, text: Copy): string {
  if (detail === "invalid_site_url") return text("seoInvalidSite");
  if (!detail || detail === "missing_site_url") return text("seoMissingSite");
  return detail;
}

function formatMs(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${value} ms`;
}

function formatCls(thousandths: number | null): string | null {
  if (thousandths == null) return null;
  return (thousandths / 1000).toFixed(3);
}

function rate(metric: "lcp" | "cls" | "inp", value: number | null): "good" | "ni" | "poor" | null {
  if (value == null) return null;
  if (metric === "lcp") return value <= 2500 ? "good" : value <= 4000 ? "ni" : "poor";
  if (metric === "inp") return value <= 200 ? "good" : value <= 500 ? "ni" : "poor";
  return value <= 100 ? "good" : value <= 250 ? "ni" : "poor";
}
