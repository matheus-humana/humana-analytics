"use client";

import { Suspense } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { formatCount } from "@/lib/i18n/format";
import { periodLabel } from "@/lib/i18n/period-label";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import type { WorkspaceTab } from "@/lib/workspace/prefs";
import type { WorkspaceProject } from "@/lib/workspace/load-workspace";

import {
  IconAnalytics,
  IconChevron,
  IconContext,
} from "./icons";
import type { GithubPanelData } from "@/lib/github/types";
import { formatScorePoints } from "@/lib/seo/explain";
import type { SeoWorkspace } from "@/lib/seo/view";

import { ComingSoon } from "@/components/ui/coming-soon";
import { EmptyLine } from "@/components/ui/empty-line";
import { InfoTip } from "@/components/ui/info-tip";

import { GithubPanel } from "./github-panel";
import { GeoPanel } from "./geo-panel";
import { ProviderIcon } from "./provider-icons";
import { SeoPanel } from "./seo-panel";
import type { TrafficSummary } from "./workspace-traffic";

export function ColumnHeader({
  title,
  onCollapse,
  collapseLabel,
  info,
}: {
  title: string;
  onCollapse?: () => void;
  collapseLabel: string;
  info?: string;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-secondary px-3">
      <div className="flex min-w-0 items-center gap-1">
        <h2 className="truncate text-sm font-medium text-foreground">{title}</h2>
        {info ? <InfoTip text={info} /> : null}
      </div>
      {onCollapse ? (
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1 text-muted transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={collapseLabel}
          title={collapseLabel}
        >
          <IconChevron />
        </button>
      ) : null}
    </header>
  );
}

export function ContextColumn({
  locale,
  project,
  onCollapse,
}: {
  locale: ChatLocale;
  project: WorkspaceProject | null;
  onCollapse?: () => void;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const sections: WorkspaceMessageKey[] = [
    "contextDocuments",
    "contextCompetitors",
    "contextAudience",
  ];
  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <ColumnHeader
        title={text("columnContext")}
        onCollapse={onCollapse}
        collapseLabel={`${text("collapseColumn")} ${text("columnContext")}`}
      />
      <div className="min-h-0 flex-1">
        <ComingSoon title={text("chatComingSoon")} body={text("contextComingSoonBody")}>
          <div className="space-y-5 px-3 py-4">
            <div>
              <p className="text-xs text-muted">{text("project")}</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {project?.name ?? text("projectUnavailable")}
              </p>
            </div>
            {sections.map((key) => (
              <div key={key} className="space-y-2">
                <p className="text-sm font-medium text-foreground">{text(key)}</p>
                <div className="space-y-1.5 rounded-xl border border-secondary p-3">
                  <div className="h-2.5 w-4/5 rounded-full bg-secondary" />
                  <div className="h-2.5 w-3/5 rounded-full bg-secondary" />
                  <div className="h-2.5 w-2/3 rounded-full bg-secondary" />
                </div>
              </div>
            ))}
          </div>
        </ComingSoon>
      </div>
    </section>
  );
}

export function AnalyticsColumn({
  locale,
  tab,
  onTab,
  onCollapse,
  traffic,
  blocked,
  blockedTitle,
  blockedBody,
  seo,
}: {
  locale: ChatLocale;
  tab: WorkspaceTab;
  onTab: (tab: WorkspaceTab) => void;
  onCollapse?: () => void;
  traffic: React.ReactNode;
  blocked: boolean;
  blockedTitle: string;
  blockedBody: string;
  seo: SeoWorkspace;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "traffic", label: text("tabTraffic") },
    { id: "seo", label: text("tabSeo") },
    { id: "geo", label: text("tabGeo") },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <ColumnHeader
        title={text("columnAnalytics")}
        onCollapse={onCollapse}
        collapseLabel={`${text("collapseColumn")} ${text("columnAnalytics")}`}
      />
      <div className="flex shrink-0 border-b border-secondary px-3 py-2" role="tablist">
        <div className="inline-flex rounded-full bg-secondary p-0.5">
          {tabs.map((item) => {
            const selected = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTab(item.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected ? "ha-primary" : "text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {blocked ? (
          <EmptyState title={blockedTitle} body={blockedBody} />
        ) : tab === "traffic" ? (
          traffic
        ) : tab === "seo" ? (
          <SeoPanel locale={locale} data={seo} />
        ) : (
          <GeoPanel locale={locale} data={seo} />
        )}
      </div>
    </section>
  );
}

export function RepositoryColumn({
  locale,
  repository,
  github,
  onCollapse,
}: {
  locale: ChatLocale;
  repository: WorkspaceProject | null;
  github: GithubPanelData;
  onCollapse?: () => void;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <ColumnHeader
        title={text("modeRepository")}
        onCollapse={onCollapse}
        collapseLabel={`${text("collapseColumn")} ${text("modeRepository")}`}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <div className="flex items-start gap-3 rounded-xl border border-secondary bg-secondary/40 p-3">
          <ProviderIcon provider="github" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {text("repoBannerTitle")}
              {repository?.repo ? (
                <span className="break-all font-normal text-muted"> · {repository.repo}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-muted">{text("repoBannerBody")}</p>
          </div>
        </div>
        {repository ? (
          <Suspense fallback={null}>
            <GithubPanel locale={locale} data={github} selectedProjectId={repository.id} />
          </Suspense>
        ) : (
          <EmptyLine title={text("repositoryUnavailable")} detail={text("githubMissingToken")} />
        )}
      </div>
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <EmptyLine title={title} detail={body} />;
}

export function CollapsedRail({
  label,
  onExpand,
  children,
}: {
  label: string;
  onExpand: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      title={label}
      aria-label={label}
      className="flex h-full w-full flex-col items-center gap-3 bg-surface px-1 py-3 text-muted transition-colors hover:bg-secondary hover:text-foreground"
    >
      <IconChevron direction="right" className="h-4 w-4 shrink-0" />
      {children}
    </button>
  );
}

export function ContextRail({
  locale,
  onExpand,
}: {
  locale: ChatLocale;
  onExpand: () => void;
}) {
  const label = `${workspaceText(locale, "expandColumn")} ${workspaceText(locale, "columnContext")}`;
  return (
    <CollapsedRail label={label} onExpand={onExpand}>
      <IconContext />
    </CollapsedRail>
  );
}

export function AnalyticsRail({
  locale,
  summary,
  seo,
  repository = false,
  onExpand,
}: {
  locale: ChatLocale;
  summary: TrafficSummary | null;
  seo: { seoScore: number | null; geoScorePoints: number | null } | null;
  repository?: boolean;
  onExpand: () => void;
}) {
  const column = repository ? "modeRepository" : "columnAnalytics";
  const label = `${workspaceText(locale, "expandColumn")} ${workspaceText(locale, column)}`;
  const users = summary == null ? null : formatCount(summary.activeUsers, locale);
  const period = summary ? periodLabel(locale, summary.periodId) : "";
  return (
    <CollapsedRail label={label} onExpand={onExpand}>
      {repository ? (
        <ProviderIcon provider="github" className="h-5 w-5" />
      ) : (
        <IconAnalytics />
      )}
      {users ? (
        <span
          className="max-w-full text-center text-[10px] font-semibold leading-tight text-accent tabular-nums"
          title={`${workspaceText(locale, "analyticsUsers")} · ${period}`}
        >
          {users}
          <span className="sr-only">
            {" "}
            {workspaceText(locale, "analyticsUsers")}
            {period ? ` · ${period}` : ""}
          </span>
        </span>
      ) : null}
      {seo?.seoScore != null ? (
        <span className="text-center text-[10px] font-semibold leading-tight text-accent tabular-nums" title={workspaceText(locale, "railSeo")}>
          {seo.seoScore}
        </span>
      ) : null}
      {seo?.geoScorePoints != null ? (
        <span className="text-center text-[10px] font-semibold leading-tight text-accent tabular-nums" title={workspaceText(locale, "railGeo")}>
          {formatScorePoints(seo.geoScorePoints)}
        </span>
      ) : null}
    </CollapsedRail>
  );
}
