"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import type { AnalyticsPeriodId } from "@/lib/analytics/period";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import {
  GITHUB_INVALID_REPO,
  GITHUB_MISSING_REPO,
  GITHUB_MISSING_TOKEN,
  type GithubPanelData,
  type GithubPanelRepo,
  type GithubRepoReport,
  type GithubTrafficPoint,
} from "@/lib/github/types";
import { hasSnapshot } from "@/lib/github/report";

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

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h3 className="font-display text-base font-semibold text-foreground">
          {text("githubHeading")}
        </h3>
        <p className="text-sm leading-relaxed text-muted">{text("githubIntro")}</p>
        <PeriodSwitch periodId={data.periodId} text={text} />
      </header>

      {!data.configured ? (
        <EmptyState
          title={text("githubDisconnectedTitle")}
          body={configMessage ?? text("githubMissingToken")}
        />
      ) : null}

      {data.configured && repos.length === 0 ? (
        <EmptyState title={text("githubDisconnectedTitle")} body={data.detail ?? text("githubCollectFailed")} />
      ) : null}

      {repos.map((repo) => (
        <RepoSection key={repo.repo} locale={locale} repo={repo} text={text} />
      ))}

      <CollectButton text={text} />
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
    <div className="flex flex-wrap gap-1" role="group" aria-label={text("chatPeriod")}>
      {options.map((option) => {
        const active = option.id === periodId;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => select(option.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              active ? "bg-accent text-white" : "text-muted hover:bg-[#f1f1f1] hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RepoSection({
  locale,
  repo,
  text,
}: {
  locale: ChatLocale;
  repo: GithubPanelRepo;
  text: Copy;
}) {
  if (!repo.ok || !repo.report) {
    return (
      <EmptyState
        title={`${text("githubDisconnectedTitle")} · ${repo.repo}`}
        body={repo.message ?? text("githubCollectFailed")}
      />
    );
  }

  if (!hasSnapshot(repo.report)) {
    return (
      <section className="space-y-2">
        <RepoTitle repo={repo} text={text} />
        <EmptyState title={text("githubEmptyTitle")} body={text("githubEmptyBody")} />
      </section>
    );
  }

  const report = repo.report;
  return (
    <section className="space-y-4">
      <RepoTitle repo={repo} text={text} />
      <div className="grid grid-cols-2 gap-2">
        <Metric
          label={text("githubViews")}
          value={report.views}
          locale={locale}
          hint={text("githubPeriodSum")}
          delta={delta(report.views, report.previousViews)}
          deltaLabel={text("githubVsPrevious")}
          footer={periodFooter(text, report, locale)}
        />
        <Metric
          label={text("githubClones")}
          value={report.clones}
          locale={locale}
          hint={text("githubPeriodSum")}
          delta={delta(report.clones, report.previousClones)}
          deltaLabel={text("githubVsPrevious")}
          footer={periodFooter(text, report, locale)}
        />
        <Metric
          label={text("githubUniqueViews")}
          value={report.uniqueViews14d}
          locale={locale}
          hint={text("githubWindow14")}
          footer={windowFooter(text, report, locale)}
        />
        <Metric
          label={text("githubUniqueClones")}
          value={report.uniqueClones14d}
          locale={locale}
          hint={text("githubWindow14")}
          footer={windowFooter(text, report, locale)}
        />
        <Metric
          label={text("githubStars")}
          value={report.counters?.stars ?? null}
          locale={locale}
          hint={text("githubCounterHint")}
          footer={counterFooter(text, report, locale)}
        />
        <Metric
          label={text("githubForks")}
          value={report.counters?.forks ?? null}
          locale={locale}
          hint={text("githubCounterHint")}
          footer={counterFooter(text, report, locale)}
        />
        <Metric
          label={text("githubWatchers")}
          value={report.counters?.watchers ?? null}
          locale={locale}
          hint={text("githubCounterHint")}
          footer={counterFooter(text, report, locale)}
        />
        <Metric
          label={text("githubDownloads")}
          value={report.counters?.releaseDownloads ?? null}
          locale={locale}
          hint={text("githubCounterHint")}
          footer={counterFooter(text, report, locale)}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted">{text("githubUniquesNote")}</p>
      <TrafficChart locale={locale} report={report} text={text} />
      <div className="grid gap-3">
        <Breakdown
          title={text("githubReferrers")}
          footer={windowFooter(text, report, locale)}
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
          footer={windowFooter(text, report, locale)}
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
        <AssetTable locale={locale} report={report} text={text} />
      </div>
      <p className="text-xs leading-relaxed text-muted">{text("githubDownloadsNote")}</p>
    </section>
  );
}

function RepoTitle({ repo, text }: { repo: GithubPanelRepo; text: Copy }) {
  return (
    <div>
      <p className="font-display text-sm font-semibold text-foreground">{repo.repo}</p>
      <p className="text-xs text-muted">
        {text("githubSeparateProject")}
        {repo.projectName ? ` · ${repo.projectName}` : ""}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  locale,
  hint,
  footer,
  delta,
  deltaLabel,
}: {
  label: string;
  value: number | null;
  locale: ChatLocale;
  hint: string;
  footer: string;
  delta?: number | null;
  deltaLabel?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-accent">
        {formatCount(value, locale)}
      </p>
      {delta != null && deltaLabel ? (
        <p className="mt-1 text-xs text-foreground">
          {formatDelta(delta, locale)} {deltaLabel}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-muted">{hint}</p>
      <p className="mt-2 text-[11px] leading-snug text-muted">{footer}</p>
    </article>
  );
}

function TrafficChart({
  locale,
  report,
  text,
}: {
  locale: ChatLocale;
  report: GithubRepoReport;
  text: Copy;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h4 className="font-display text-sm font-semibold text-foreground">{text("githubSeriesTitle")}</h4>
      <p className="mt-1 text-xs text-muted">{text("githubSeriesHint")}</p>
      <p className="mt-2 text-[11px] text-muted">{periodFooter(text, report, locale)}</p>
      <SeriesSvg points={report.traffic} />
      <div className="mt-3 overflow-x-auto">
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

function SeriesSvg({ points }: { points: GithubTrafficPoint[] }) {
  const width = 320;
  const height = 120;
  const pad = 8;
  const known = points.flatMap((point) => [point.views, point.clones].filter((value): value is number => value != null));
  const max = Math.max(1, ...known);
  const xAt = (index: number) =>
    points.length <= 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);
  const yAt = (value: number) => pad + (1 - value / max) * (height - pad * 2);
  const line = (key: "views" | "clones") =>
    points
      .map((point, index) => {
        const value = point[key];
        if (value == null) return null;
        return `${index === 0 || points[index - 1]?.[key] == null ? "M" : "L"} ${xAt(index)} ${yAt(value)}`;
      })
      .filter(Boolean)
      .join(" ");

  if (known.length === 0) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-28 w-full" role="img">
      <path d={line("views")} fill="none" stroke="var(--accent)" strokeWidth="2" />
      <path d={line("clones")} fill="none" stroke="var(--navy)" strokeWidth="2" />
    </svg>
  );
}

function Breakdown({
  title,
  footer,
  empty,
  rows,
  locale,
  totalLabel,
  uniqueLabel,
}: {
  title: string;
  footer: string;
  empty: string;
  rows: Array<{ name: string; total: number; uniques: number }>;
  locale: ChatLocale;
  totalLabel: string;
  uniqueLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h4 className="font-display text-sm font-semibold text-foreground">{title}</h4>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">{empty}</p> : null}
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.name}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{row.name}</span>
              <span className="shrink-0 text-muted">
                {totalLabel} {formatCount(row.total, locale)} · {uniqueLabel}{" "}
                {formatCount(row.uniques, locale)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f1f1f1]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(row.total / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-muted">{footer}</p>
    </section>
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
    <section className="rounded-xl border border-border bg-surface p-3">
      <h4 className="font-display text-sm font-semibold text-foreground">{text("githubAssets")}</h4>
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
      <p className="mt-3 text-[11px] leading-snug text-muted">{counterFooter(text, report, locale)}</p>
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
        className="rounded-lg bg-accent px-3 py-1.5 font-display text-sm font-medium text-white transition-colors hover:bg-[#4f61b0] disabled:cursor-not-allowed disabled:opacity-50"
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-[#f8f8f8] px-4 py-5">
      <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
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
