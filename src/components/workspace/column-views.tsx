"use client";

import Link from "next/link";
import { Suspense } from "react";

import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import { workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";
import type { WorkspaceTab } from "@/lib/workspace/prefs";
import type { ConnectionSnapshot } from "@/lib/workspace/status-log";
import type { WorkspaceProject } from "@/lib/workspace/load-workspace";

import {
  IconActions,
  IconAnalytics,
  IconChevron,
  IconContext,
} from "./icons";
import type { GithubPanelData } from "@/lib/github/types";
import { formatScorePoints } from "@/lib/seo/explain";
import { groupFindings } from "@/lib/seo/groups";
import type { SeoWorkspace } from "@/lib/seo/view";

import { EmptyLine } from "@/components/ui/empty-line";
import { InfoTip } from "@/components/ui/info-tip";

import { GithubPanel } from "./github-panel";
import { GeoPanel } from "./geo-panel";
import { FindingGroupCard, SeoPanel } from "./seo-panel";
import type { TrafficSummary } from "./workspace-traffic";

type Copy = (key: WorkspaceMessageKey) => string;

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
  foreign,
  connections,
  onCollapse,
}: {
  locale: ChatLocale;
  project: WorkspaceProject | null;
  foreign: boolean;
  connections: ConnectionSnapshot[];
  onCollapse?: () => void;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <ColumnHeader
        title={text("columnContext")}
        onCollapse={onCollapse}
        collapseLabel={`${text("collapseColumn")} ${text("columnContext")}`}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {project ? (
          <div>
            <p className="text-sm font-medium text-foreground">{project.name}</p>
            <p className="text-xs text-muted">
              <span className="sr-only">{text("slug")}: </span>
              {project.slug}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">{text("projectUnavailable")}</p>
        )}

        <div>
          <p className="text-xs text-muted">{text("connections")}</p>
          {foreign ? (
            <p className="mt-2 text-sm text-muted">{text("connectionsNotLoaded")}</p>
          ) : (
            <ul className="mt-1">
              {connections.map((connection) => (
                <ConnectionRow key={connection.provider} connection={connection} text={text} />
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-1">
            <Link
              href="/data-sources"
              className="text-sm text-foreground underline-offset-2 hover:underline"
            >
              {text("openDataSources")}
            </Link>
            <InfoTip text={text("futureSources")} />
          </div>
        </div>
      </div>
    </section>
  );
}

function providerName(provider: ConnectionSnapshot["provider"]): string {
  if (provider === "ga4") return "GA4";
  if (provider === "clarity") return "Clarity";
  if (provider === "github") return "GitHub";
  if (provider === "pagespeed") return "PageSpeed";
  if (provider === "crawl") return "Crawl";
  return "Vercel";
}

function connectionTitle(connection: ConnectionSnapshot, text: Copy): string {
  const state = connection.status === "error"
    ? text("statusError")
    : connection.connected
      ? text("statusConnected")
      : text("statusDisconnected");
  const detail = connection.detail?.trim();
  return detail
    ? `${providerName(connection.provider)} · ${state} · ${detail}`
    : `${providerName(connection.provider)} · ${state}`;
}

function ConnectionRow({
  connection,
  text,
}: {
  connection: ConnectionSnapshot;
  text: Copy;
}) {
  const error = connection.status === "error";
  const on = connection.connected && !error;
  const label = connectionTitle(connection, text);
  return (
    <li>
      <span className="flex items-center gap-2 py-1" title={label}>
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            on ? "bg-status-on" : error ? "bg-negative" : "bg-border"
          }`}
          aria-hidden
        />
        <span className="text-sm text-foreground">{providerName(connection.provider)}</span>
        <span className="sr-only">{label}</span>
      </span>
    </li>
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
  github,
  seo,
  projectId,
}: {
  locale: ChatLocale;
  tab: WorkspaceTab;
  onTab: (tab: WorkspaceTab) => void;
  onCollapse?: () => void;
  traffic: React.ReactNode;
  blocked: boolean;
  blockedTitle: string;
  blockedBody: string;
  github: GithubPanelData;
  seo: SeoWorkspace;
  projectId: string | null;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const tabs: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "traffic", label: text("tabTraffic") },
    { id: "seo", label: text("tabSeo") },
    { id: "geo", label: text("tabGeo") },
    { id: "github", label: text("tabGithub") },
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
        {tab === "traffic" ? (
          blocked ? (
            <EmptyState title={blockedTitle} body={blockedBody} />
          ) : (
            traffic
          )
        ) : null}
        {tab === "seo" ? (
          blocked ? (
            <EmptyState title={blockedTitle} body={blockedBody} />
          ) : (
            <SeoPanel locale={locale} data={seo} />
          )
        ) : null}
        {tab === "geo" ? (
          blocked ? (
            <EmptyState title={blockedTitle} body={blockedBody} />
          ) : (
            <GeoPanel locale={locale} data={seo} />
          )
        ) : null}
        {tab === "github" ? (
          <Suspense fallback={null}>
            <GithubPanel locale={locale} data={github} selectedProjectId={projectId} />
          </Suspense>
        ) : null}
      </div>
    </section>
  );
}

export function ActionsColumn({
  locale,
  seo,
  blocked,
  blockedTitle,
  blockedBody,
  onCollapse,
}: {
  locale: ChatLocale;
  seo: SeoWorkspace;
  blocked: boolean;
  blockedTitle: string;
  blockedBody: string;
  onCollapse?: () => void;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  return (
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <ColumnHeader
        title={text("columnActions")}
        onCollapse={onCollapse}
        collapseLabel={`${text("collapseColumn")} ${text("columnActions")}`}
        info={text("actionsAuto")}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {blocked ? <EmptyLine title={blockedTitle} detail={blockedBody} /> : null}
        {!blocked && !seo.configured ? (
          <EmptyLine title={text("actionsEmptyTitle")} detail={text("seoMissingSite")} />
        ) : null}
        {!blocked && seo.configured ? (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {text("actionsNeedAttention")}
              </h3>
              {seo.openFindings.length === 0 ? (
                <p className="text-sm text-muted">
                  {seo.crawl ? text("actionsNoneOpen") : text("seoNoCrawl")}
                </p>
              ) : (
                groupFindings(seo.openFindings).map((group) => (
                  <FindingGroupCard key={group.key} locale={locale} group={group} text={text} />
                ))
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">
                {text("actionsResolved")}
              </h3>
              {seo.resolvedFindings.length === 0 ? (
                <p className="text-sm text-muted">{text("actionsNoneResolved")}</p>
              ) : (
                groupFindings(seo.resolvedFindings).map((group) => (
                  <FindingGroupCard key={group.key} locale={locale} group={group} text={text} />
                ))
              )}
            </section>
          </>
        ) : null}
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
  connections,
  onExpand,
}: {
  locale: ChatLocale;
  connections: ConnectionSnapshot[];
  onExpand: () => void;
}) {
  const label = `${workspaceText(locale, "expandColumn")} ${workspaceText(locale, "columnContext")}`;
  return (
    <CollapsedRail label={label} onExpand={onExpand}>
      <IconContext />
      <span className="flex flex-col items-center gap-1">
        {connections.map((connection) => (
          <span
            key={connection.provider}
            title={connectionTitle(connection, (key) => workspaceText(locale, key))}
            className={`h-1.5 w-1.5 rounded-full ${
              connection.connected && connection.status !== "error"
                ? "bg-status-on"
                : "bg-border"
            }`}
          />
        ))}
      </span>
    </CollapsedRail>
  );
}

export function AnalyticsRail({
  locale,
  summary,
  seo,
  onExpand,
}: {
  locale: ChatLocale;
  summary: TrafficSummary | null;
  seo: { seoScore: number | null; geoScorePoints: number | null } | null;
  onExpand: () => void;
}) {
  const label = `${workspaceText(locale, "expandColumn")} ${workspaceText(locale, "columnAnalytics")}`;
  const users =
    summary == null
      ? null
      : new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR").format(
          summary.activeUsers
        );
  return (
    <CollapsedRail label={label} onExpand={onExpand}>
      <IconAnalytics />
      {users ? (
        <span
          className="max-w-full text-center text-[10px] font-semibold leading-tight text-accent tabular-nums"
          title={`${workspaceText(locale, "analyticsUsers")} · ${summary?.periodLabel ?? ""}`}
        >
          {users}
          <span className="sr-only">
            {" "}
            {workspaceText(locale, "analyticsUsers")}
            {summary?.periodLabel ? ` · ${summary.periodLabel}` : ""}
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

export function ActionsRail({
  locale,
  openCount,
  onExpand,
}: {
  locale: ChatLocale;
  openCount: number | null;
  onExpand: () => void;
}) {
  const label = `${workspaceText(locale, "expandColumn")} ${workspaceText(locale, "columnActions")}`;
  return (
    <CollapsedRail label={label} onExpand={onExpand}>
      <IconActions />
      {openCount != null ? (
        <span className="text-[10px] font-semibold text-accent tabular-nums" title={workspaceText(locale, "railActions")}>
          {openCount}
        </span>
      ) : null}
    </CollapsedRail>
  );
}
