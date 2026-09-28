"use client";

import { useState } from "react";

import { FreshnessBadge } from "@/components/freshness/freshness-badge";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { formatCalendarDay } from "@/lib/i18n/format";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import { explainFinding, explainVitalOrigin } from "@/lib/seo/explain";
import { groupFindings, type FindingGroup } from "@/lib/seo/groups";
import type { FindingView, ScoreCard, SeoWorkspace } from "@/lib/seo/view";
import type { VitalOrigin } from "@/lib/seo/types";

import { Disclosure } from "@/components/ui/disclosure";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyLine } from "@/components/ui/empty-line";
import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard } from "@/components/ui/kpi-card";
import { ScoreRing } from "@/components/ui/score-ring";

import { IconChevron } from "./icons";
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

  if (!data.configured) {
    return (
      <div className="space-y-4">
        <FreshnessBadge
          cadence="snapshot"
          observedAt={data.pagespeedUpdatedAt}
          ok={false}
          locale={locale}
        />
        <EmptyLine title={text("seoHeading")} detail={configMessage(data.detail, text)} />
      </div>
    );
  }

  const sourceLine = [text("seoIntro"), data.siteUrl].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="truncate text-sm font-medium text-foreground">{text("seoHeading")}</h3>
        <FreshnessBadge
          cadence="snapshot"
          observedAt={data.pagespeedUpdatedAt}
          ok={data.pagespeedStatus === "active"}
          locale={locale}
        />
        <InfoTip text={sourceLine} />
      </header>

      {pages.length > 1 ? (
        <div>
          <p className="mb-1 text-xs text-muted">{text("seoPage")}</p>
          <Dropdown
            value={selected}
            onChange={setPageUrl}
            ariaLabel={text("seoPage")}
            size="sm"
            className="w-full"
            options={pages.map((url) => ({ value: url, label: url }))}
          />
        </div>
      ) : null}

      {mobile || desktop ? (
        <section className="space-y-5 rounded-xl border border-secondary bg-secondary/30 p-4">
          {mobile ? (
            <StrategyScores locale={locale} title={text("seoMobile")} score={mobile} text={text} />
          ) : null}
          {desktop ? (
            <StrategyScores locale={locale} title={text("seoDesktop")} score={desktop} text={text} />
          ) : null}
        </section>
      ) : (
        <p className="text-sm text-muted">{text("seoNoPagespeed")}</p>
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-medium text-foreground">{text("seoCwv")}</h4>
        <VitalRow locale={locale} label={text("seoMobile")} score={mobile} text={text} />
        <VitalRow locale={locale} label={text("seoDesktop")} score={desktop} text={text} />
      </section>

      <Disclosure title={text("technicalDetails")}>
        {data.pagespeedStatus === "error" && data.pagespeedDetail ? (
          <EmptyLine title={text("statusError")} detail={data.pagespeedDetail} />
        ) : null}
        {data.crawlStatus === "error" && data.crawlDetail ? (
          <EmptyLine title={text("statusError")} detail={data.crawlDetail} />
        ) : null}

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

        <EmptyLine title={text("seoSearchConsoleTitle")} detail={text("seoSearchConsoleBody")} />

        <SeoCollectButton
          label={text("seoCollect")}
          pendingLabel={text("seoCollecting")}
          doneLabel={text("seoCollected")}
          failedLabel={text("seoCollectFailed")}
        />
      </Disclosure>

      <FindingsSection locale={locale} data={data} source="seo" />
    </div>
  );
}

export function FindingsSection({
  locale,
  data,
  source,
}: {
  locale: ChatLocale;
  data: SeoWorkspace;
  source: FindingView["source"];
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const open = groupFindings(data.openFindings.filter((item) => item.source === source));
  const resolved = groupFindings(
    data.resolvedFindings.filter((item) => item.source === source)
  );
  return (
    <section className="space-y-3 border-t border-secondary pt-5">
      <header className="flex min-w-0 items-center gap-1">
        <h3 className="truncate text-sm font-medium text-foreground">{text("columnActions")}</h3>
        <InfoTip text={text("actionsAuto")} />
      </header>
      <div>
        <h4 className="text-xs text-muted">{text("actionsNeedAttention")}</h4>
        {open.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            {data.crawl ? text("actionsNoneOpen") : text("seoNoCrawl")}
          </p>
        ) : (
          open.map((group) => (
            <FindingGroupCard key={group.key} locale={locale} group={group} text={text} />
          ))
        )}
      </div>
      {resolved.length > 0 ? (
        <Disclosure title={`${text("actionsResolved")} (${resolved.length})`}>
          <div>
            {resolved.map((group) => (
              <FindingGroupCard key={group.key} locale={locale} group={group} text={text} />
            ))}
          </div>
        </Disclosure>
      ) : null}
    </section>
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
    <FindingShell
      title={copy?.title ?? group.code}
      severity={group.severity}
      text={text}
    >
      <div className="flex items-start gap-1">
        <p className="text-xs leading-relaxed text-muted">{copy?.fix}</p>
        <InfoTip text={meta} />
      </div>
      {group.detail ? (
        <p className="text-xs text-foreground">{findingDetail(group.code, group.detail, text)}</p>
      ) : null}
      <p className="text-sm font-medium tabular-nums text-accent">{countLabel}</p>
      <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-muted">
        {group.pages.map((page) => (
          <li key={`${page.url}:${page.detail}`} className="break-all">
            {page.url}
            {group.detail == null && page.detail
              ? ` · ${findingDetail(group.code, page.detail, text)}`
              : ""}
          </li>
        ))}
      </ul>
    </FindingShell>
  );
}

function FindingShell({
  title,
  severity,
  text,
  children,
}: {
  title: string;
  severity: string;
  text: Copy;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-secondary last:border-b-0">
      <summary className="flex cursor-pointer list-none items-start gap-2 rounded-md py-2.5 [&::-webkit-details-marker]:hidden">
        <p className="min-w-0 flex-1 text-sm text-foreground">{title}</p>
        <SeverityBadge severity={severity} text={text} />
        <IconChevron
          direction="down"
          className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform group-open:-rotate-90"
        />
      </summary>
      <div className="space-y-2 pb-3">{children}</div>
    </details>
  );
}

function SeverityBadge({ severity, text }: { severity: string; text: Copy }) {
  if (severity === "critical") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-negative/60 bg-negative-bg px-2 py-0.5 text-[11px] font-medium text-negative">
        <span
          aria-hidden
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-negative text-[9px] font-bold leading-none text-white"
        >
          !
        </span>
        {text("seoCritical")}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-warning-border bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
      {text("seoWarning")}
    </span>
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
  score,
  text,
}: {
  locale: ChatLocale;
  title: string;
  score: ScoreCard;
  text: Copy;
}) {
  const citation = `${text("seoSourcePagespeed")} · ${score.pageUrl} · ${formatDay(score.day, locale)}`;
  const rings: Array<{ key: WorkspaceMessageKey; value: number | null }> = [
    { key: "seoPerformance", value: score.performance },
    { key: "seoAccessibility", value: score.accessibility },
    { key: "seoBestPractices", value: score.bestPractices },
    { key: "seoSeo", value: score.seo },
  ];
  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h4>
        <InfoTip text={citation} />
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-4">
        {rings.map((ring) => (
          <ScoreRing
            key={ring.key}
            label={text(ring.key)}
            score={ring.value}
            title={`${text(ring.key)} · ${title} · ${citation}`}
          />
        ))}
      </div>
    </div>
  );
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
  return formatCalendarDay(value, locale);
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
