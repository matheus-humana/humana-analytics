"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { FreshnessBadge } from "@/components/freshness/freshness-badge";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { ANALYTICS_PERIODS, type AnalyticsPeriodId } from "@/lib/analytics/period";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import {
  GITHUB_INVALID_REPO,
  GITHUB_MISSING_REPO,
  GITHUB_MISSING_TOKEN,
  type GithubPanelData,
  type GithubPanelRepo,
  type GithubRepoReport,
} from "@/lib/github/types";
import { hasSnapshot } from "@/lib/github/report";
import { Disclosure } from "@/components/ui/disclosure";
import { EmptyLine } from "@/components/ui/empty-line";
import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard, type KpiDelta } from "@/components/ui/kpi-card";
import { RankList } from "@/components/ui/rank-list";

type Copy = (key: WorkspaceMessageKey) => string;

export function GithubPanel({
  locale,
  data,
  selectedProjectId,
}: {
  locale: ChatLocale;
  data: GithubPanelData;
  selectedProjectId: string | null;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const repos = visibleRepos(data.repos, selectedProjectId);
  const configMessage = configCopy(data.detail, text);

  const periodLabel = periodShort(data.periodId, text);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodSwitch periodId={data.periodId} text={text} />
        <FreshnessBadge
          cadence="hourly"
          observedAt={data.collectedAt}
          ok={data.status === "active"}
          locale={locale}
          hint={text("githubTrafficLag")}
        />
        <InfoTip text={`${text("githubIntro")} ${text("githubTrafficLag")}`} />
      </div>

      {!data.configured ? (
        <EmptyLine
          title={text("githubDisconnectedTitle")}
          detail={configMessage ?? text("githubMissingToken")}
        />
      ) : null}

      {data.configured && repos.length === 0 ? (
        <EmptyLine
          title={text("githubDisconnectedTitle")}
          detail={data.detail ?? text("githubCollectFailed")}
        />
      ) : null}

      {repos.map((repo) => (
        <RepoSection
          key={repo.repo}
          locale={locale}
          repo={repo}
          text={text}
          periodLabel={periodLabel}
        />
      ))}

      <Disclosure title={text("technicalDetails")}>
        <CollectButton text={text} />
      </Disclosure>
    </div>
  );
}

function visibleRepos(repos: GithubPanelRepo[], selectedProjectId: string | null) {
  if (!selectedProjectId) return repos;
  const match = repos.filter((repo) => repo.projectId === selectedProjectId);
  return match.length > 0 ? match : repos;
}

function configCopy(detail: string | null, text: Copy): string | null {
  if (!detail) return null;
  if (detail === GITHUB_MISSING_TOKEN) return text("githubMissingToken");
  if (detail === GITHUB_MISSING_REPO) return text("githubMissingRepo");
  if (detail.startsWith(GITHUB_INVALID_REPO)) {
    const sample = detail.slice(GITHUB_INVALID_REPO.length).replace(/^:/, "").trim();
    return sample ? `${text("githubInvalidRepo")} (${sample})` : text("githubInvalidRepo");
  }
  return detail;
}

function PeriodSwitch({
  periodId,
  text,
}: {
  periodId: AnalyticsPeriodId;
  text: Copy;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const options: Array<{ id: AnalyticsPeriodId; label: string }> = [
    { id: "7d", label: text("githubPeriod7") },
    { id: "28d", label: text("githubPeriod28") },
    { id: "90d", label: text("githubPeriod90") },
  ];

  function select(id: AnalyticsPeriodId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "7d") params.delete("period");
    else params.set("period", id);
    const query = params.toString();
    router.replace(query ? `/dashboard?${query}` : "/dashboard");
  }

  return (
    <div
      className="inline-flex items-center rounded-full bg-secondary p-0.5"
      role="group"
      aria-label={text("chatPeriod")}
    >
      {options.map((option) => {
        const active = option.id === periodId;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => select(option.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              active ? "ha-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function periodShort(periodId: AnalyticsPeriodId, text: Copy): string {
  if (periodId === "7d") return text("githubPeriod7");
  if (periodId === "28d") return text("githubPeriod28");
  if (periodId === "90d") return text("githubPeriod90");
  return ANALYTICS_PERIODS[periodId].shortLabel;
}

function RepoSection({
  locale,
  repo,
  text,
  periodLabel,
}: {
  locale: ChatLocale;
  repo: GithubPanelRepo;
  text: Copy;
  periodLabel: string;
}) {
  if (!repo.ok || !repo.report) {
    return (
      <EmptyLine
        title={`${text("githubDisconnectedTitle")} · ${repo.repo}`}
        detail={repo.message ?? text("githubCollectFailed")}
      />
    );
  }

  if (!hasSnapshot(repo.report)) {
    return (
      <section className="space-y-2">
        <RepoTitle repo={repo} text={text} />
        <EmptyLine title={text("githubEmptyTitle")} detail={text("githubEmptyBody")} />
      </section>
    );
  }

  const report = repo.report;
  const periodCite = periodFooter(text, report, locale);
  const windowCite = `${text("githubUniquesNote")} ${windowFooter(text, report, locale)}`;
  const counterCite = `${text("githubCounterHint")}. ${counterFooter(text, report, locale)}`;
  return (
    <section className="space-y-6">
      <RepoTitle repo={repo} text={text} />
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        <Metric
          label={`${text("githubViews")} · ${periodLabel}`}
          value={report.views}
          locale={locale}
          citation={`${text("githubPeriodSum")}. ${periodCite}`}
          delta={delta(report.views, report.previousViews)}
          deltaLabel={text("githubVsPrevious")}
          series={report.traffic.map((point) => point.views)}
        />
        <Metric
          label={`${text("githubClones")} · ${periodLabel}`}
          value={report.clones}
          locale={locale}
          citation={`${text("githubPeriodSum")}. ${periodCite}`}
          delta={delta(report.clones, report.previousClones)}
          deltaLabel={text("githubVsPrevious")}
          series={report.traffic.map((point) => point.clones)}
        />
        <Metric
          label={`${text("githubUniqueViews")} · ${text("githubWindowShort")}`}
          value={report.uniqueViews14d}
          locale={locale}
          citation={windowCite}
        />
        <Metric
          label={`${text("githubUniqueClones")} · ${text("githubWindowShort")}`}
          value={report.uniqueClones14d}
          locale={locale}
          citation={windowCite}
        />
        <Metric
          label={text("githubStars")}
          value={report.counters?.stars ?? null}
          locale={locale}
          citation={counterCite}
          series={report.counterSeries.map((point) => point.stars)}
        />
        <Metric
          label={text("githubForks")}
          value={report.counters?.forks ?? null}
          locale={locale}
          citation={counterCite}
          series={report.counterSeries.map((point) => point.forks)}
        />
        <Metric
          label={text("githubWatchers")}
          value={report.counters?.watchers ?? null}
          locale={locale}
          citation={counterCite}
          series={report.counterSeries.map((point) => point.watchers)}
        />
        <Metric
          label={text("githubDownloads")}
          value={report.counters?.releaseDownloads ?? null}
          locale={locale}
          citation={`${text("githubDownloadsNote")} ${counterCite}`}
          series={report.counterSeries.map((point) => point.releaseDownloads)}
        />
      </div>
      <div className="grid gap-2">
        <Breakdown
          title={text("githubReferrers")}
          info={windowFooter(text, report, locale)}
          empty={text("githubNoRows")}
          rows={report.referrers.map((item) => ({
            name: item.referrer,
            total: item.count,
            uniques: item.uniques,
          }))}
          locale={locale}
          totalLabel={text("githubCount")}
          uniqueLabel={text("githubUniques")}
        />
        <Breakdown
          title={text("githubPaths")}
          info={windowFooter(text, report, locale)}
          empty={text("githubNoRows")}
          rows={report.paths.map((item) => ({
            name: item.path,
            total: item.count,
            uniques: item.uniques,
          }))}
          locale={locale}
          totalLabel={text("githubCount")}
          uniqueLabel={text("githubUniques")}
        />
        <Disclosure title={text("githubDetails")}>
          <TrafficTable locale={locale} report={report} text={text} />
          <AssetTable locale={locale} report={report} text={text} />
        </Disclosure>
      </div>
    </section>
  );
}

function RepoTitle({ repo, text }: { repo: GithubPanelRepo; text: Copy }) {
  const note = `${text("githubSeparateProject")}${repo.projectName ? ` · ${repo.projectName}` : ""}`;
  return (
    <div className="flex items-center gap-1">
      <p className="truncate text-sm font-medium text-foreground">{repo.repo}</p>
      <InfoTip text={note} />
    </div>
  );
}

function Metric({
  label,
  value,
  locale,
  citation,
  delta,
  deltaLabel,
  series,
}: {
  label: string;
  value: number | null;
  locale: ChatLocale;
  citation: string;
  delta?: number | null;
  deltaLabel?: string;
  series?: Array<number | null>;
}) {
  const change = delta != null && deltaLabel ? toDelta(delta, deltaLabel, locale) : null;
  const cited = change ? `${change.text} ${change.label}. ${citation}` : citation;
  return (
    <KpiCard
      label={label}
      value={formatCount(value, locale)}
      citation={cited}
      delta={change}
      series={series}
    />
  );
}

function TrafficTable({
  locale,
  report,
  text,
}: {
  locale: ChatLocale;
  report: GithubRepoReport;
  text: Copy;
}) {
  return (
    <section>
      <div className="flex items-center gap-1">
        <h4 className="text-sm font-medium text-foreground">{text("githubSeriesTitle")}</h4>
        <InfoTip text={`${text("githubSeriesHint")} ${periodFooter(text, report, locale)}`} />
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th className="py-1 pr-2 font-medium">{text("githubDay")}</th>
              <th className="py-1 pr-2 font-medium">{text("githubViews")}</th>
              <th className="py-1 pr-2 font-medium">{text("githubUniqueViews")}</th>
              <th className="py-1 pr-2 font-medium">{text("githubClones")}</th>
              <th className="py-1 font-medium">{text("githubUniqueClones")}</th>
            </tr>
          </thead>
          <tbody>
            {report.traffic.map((point) => (
              <tr key={point.day} className="border-t border-border">
                <td className="py-1 pr-2">{formatDay(point.day, locale)}</td>
                <td className="py-1 pr-2">{formatCount(point.views, locale)}</td>
                <td className="py-1 pr-2">{formatCount(point.uniqueViews, locale)}</td>
                <td className="py-1 pr-2">{formatCount(point.clones, locale)}</td>
                <td className="py-1">{formatCount(point.uniqueClones, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Breakdown({
  title,
  info,
  empty,
  rows,
  locale,
  totalLabel,
  uniqueLabel,
}: {
  title: string;
  info: string;
  empty: string;
  rows: Array<{ name: string; total: number; uniques: number }>;
  locale: ChatLocale;
  totalLabel: string;
  uniqueLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <Disclosure title={`${title} (${rows.length})`}>
      <RankList
        info={info}
        empty={empty}
        rows={rows.map((row) => ({
          name: row.name,
          value: `${totalLabel} ${formatCount(row.total, locale)} · ${uniqueLabel} ${formatCount(row.uniques, locale)}`,
          width: (row.total / max) * 100,
        }))}
      />
    </Disclosure>
  );
}

function AssetTable({
  locale,
  report,
  text,
}: {
  locale: ChatLocale;
  report: GithubRepoReport;
  text: Copy;
}) {
  return (
    <section>
      <div className="flex items-center gap-1">
        <h4 className="text-sm font-medium text-foreground">{text("githubAssets")}</h4>
        <InfoTip
          text={`${text("githubDownloadsNote")} ${counterFooter(text, report, locale)}`}
        />
      </div>
      {report.assets.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{text("githubNoRows")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-2 font-medium">{text("githubTag")}</th>
                <th className="py-1 pr-2 font-medium">{text("githubAsset")}</th>
                <th className="py-1 font-medium">{text("githubDownloads")}</th>
              </tr>
            </thead>
            <tbody>
              {report.assets.map((asset) => (
                <tr key={`${asset.tag}:${asset.name}`} className="border-t border-border">
                  <td className="py-1 pr-2">{asset.tag}</td>
                  <td className="py-1 pr-2">{asset.name}</td>
                  <td className="py-1">{formatCount(asset.downloads, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CollectButton({ text }: { text: Copy }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function collect() {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/github/collect", { method: "POST" });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ ok?: boolean; error?: string; repo?: string }>;
      };
      if (!response.ok || body.ok === false) {
        const fromResult = body.results?.find((result) => result.error)?.error;
        setFeedback(explainCollectError(body.error || fromResult || "", text));
        return;
      }
      setFeedback(text("githubCollected"));
      router.refresh();
    } catch {
      setFeedback(text("githubCollectFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void collect()}
        disabled={pending}
        className="ha-primary rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? text("githubCollecting") : text("githubCollect")}
      </button>
      {feedback ? <p className="text-sm text-foreground">{feedback}</p> : null}
    </div>
  );
}

function periodFooter(text: Copy, report: GithubRepoReport, locale: ChatLocale): string {
  return `${text("githubSource")} · ${report.repo} · ${formatDay(report.from, locale)}–${formatDay(report.to, locale)} · ${report.recordedDays} ${text("githubRecordedDays")}`;
}

function windowFooter(text: Copy, report: GithubRepoReport, locale: ChatLocale): string {
  const collected = report.windowCollectedOn
    ? `${text("githubCollectedOn")} ${formatDay(report.windowCollectedOn, locale)}`
    : text("githubWindow14");
  return `${text("githubSource")} · ${report.repo} · ${text("githubWindow14")} · ${collected}`;
}

function counterFooter(text: Copy, report: GithubRepoReport, locale: ChatLocale): string {
  const day = report.counters ? formatDay(report.counters.day, locale) : formatDay(report.to, locale);
  return `${text("githubSource")} · ${report.repo} · ${day}`;
}

function explainCollectError(error: string, text: Copy): string {
  if (!error) return text("githubCollectFailed");
  if (error === GITHUB_MISSING_TOKEN) return text("githubMissingToken");
  if (error === GITHUB_MISSING_REPO) return text("githubMissingRepo");
  if (error.startsWith(GITHUB_INVALID_REPO)) {
    const sample = error.slice(GITHUB_INVALID_REPO.length).replace(/^:/, "").trim();
    return sample ? `${text("githubInvalidRepo")} (${sample})` : text("githubInvalidRepo");
  }
  return error;
}

function formatCount(value: number | null, locale: ChatLocale): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR").format(value);
}

function formatDay(day: string, locale: ChatLocale): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function delta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function formatDelta(value: number, locale: ChatLocale): string {
  const formatted = new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
  return `${formatted}%`;
}

function toDelta(value: number, label: string, locale: ChatLocale): KpiDelta {
  return {
    text: formatDelta(value, locale),
    label,
    direction: value > 0 ? "up" : value < 0 ? "down" : "flat",
  };
}
