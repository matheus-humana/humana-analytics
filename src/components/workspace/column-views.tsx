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
import type { SeoWorkspace } from "@/lib/seo/view";

import { GithubPanel } from "./github-panel";
import { GeoPanel } from "./geo-panel";
import { FindingCard, SeoPanel } from "./seo-panel";
import type { TrafficSummary } from "./workspace-traffic";

type Copy = (key: WorkspaceMessageKey) => string;

export function ColumnHeader({
  title,
  onCollapse,
  collapseLabel,
}: {
  title: string;
  onCollapse?: () => void;
  collapseLabel: string;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
      <h2 className="truncate font-display text-sm font-semibold text-foreground">
        {title}
      </h2>
      {onCollapse ? (
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1 text-muted transition-colors hover:bg-[#f1f1f1] hover:text-foreground"
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
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {project ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {text("project")}
            </p>
            <p className="mt-1 font-display text-base font-semibold text-foreground">
              {project.name}
            </p>
            <p className="mt-1 text-xs text-muted">
              {text("slug")}: {project.slug}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted">{text("projectUnavailable")}</p>
        )}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {text("connections")}
          </p>
          {foreign ? (
            <p className="mt-2 text-sm text-muted">{text("connectionsNotLoaded")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {connections.map((connection) => (
                <li
                  key={connection.provider}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {providerName(connection.provider)}
                  </span>
                  <ConnectionPill connection={connection} text={text} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {text("futureSources")}
          </p>
          <Link
            href="/data-sources"
            className="mt-3 inline-flex rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:bg-accent-soft"
          >
            {text("openDataSources")}
          </Link>
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

function ConnectionPill({
  connection,
  text,
}: {
  connection: ConnectionSnapshot;
  text: Copy;
}) {
  const error = connection.status === "error";
  const on = connection.connected && !error;
  const label = error
    ? text("statusError")
    : on
      ? text("statusConnected")
      : text("statusDisconnected");
  return (
    <span
      title={connectionTitle(connection, text)}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
        on
          ? "bg-accent-soft text-accent"
          : error
            ? "bg-[#f1f1f1] text-foreground"
            : "bg-[#f1f1f1] text-muted"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-muted"}`}
        aria-hidden
      />
      {label}
    </span>
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
      <div className="flex shrink-0 gap-1 border-b border-border px-3 py-2" role="tablist">
        {tabs.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTab(item.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-[#f1f1f1] hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {blocked ? <EmptyState title={blockedTitle} body={blockedBody} /> : null}
        {!blocked && !seo.configured ? (
          <EmptyState title={text("actionsEmptyTitle")} body={text("seoMissingSite")} />
        ) : null}
        {!blocked && seo.configured ? (
          <>
            <p className="text-xs leading-relaxed text-muted">{text("actionsAuto")}</p>
            <section className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-foreground">
                {text("actionsNeedAttention")}
              </h3>
              {seo.openFindings.length === 0 ? (
                <p className="text-sm text-muted">
                  {seo.crawl ? text("actionsNoneOpen") : text("seoNoCrawl")}
                </p>
              ) : (
                seo.openFindings.map((item) => (
                  <FindingCard key={item.fingerprint} locale={locale} item={item} text={text} />
                ))
              )}
            </section>
            <section className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-foreground">
                {text("actionsResolved")}
              </h3>
              {seo.resolvedFindings.length === 0 ? (
                <p className="text-sm text-muted">{text("actionsNoneResolved")}</p>
              ) : (
                seo.resolvedFindings.map((item) => (
                  <FindingCard key={item.fingerprint} locale={locale} item={item} text={text} />
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
  return (
    <div className="rounded-xl border border-dashed border-border bg-[#f8f8f8] px-4 py-5">
      <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
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
      className="flex h-full w-full flex-col items-center gap-3 bg-surface px-1 py-3 text-muted transition-colors hover:bg-[#f8f8f8] hover:text-foreground"
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
                ? "bg-accent"
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
          className="max-w-full text-center text-[10px] font-semibold leading-tight text-foreground"
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
        <span className="text-center text-[10px] font-semibold leading-tight text-foreground" title={workspaceText(locale, "railSeo")}>
          {seo.seoScore}
        </span>
      ) : null}
      {seo?.geoScorePoints != null ? (
        <span className="text-center text-[10px] font-semibold leading-tight text-foreground" title={workspaceText(locale, "railGeo")}>
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
        <span className="text-[10px] font-semibold text-foreground" title={workspaceText(locale, "railActions")}>
          {openCount}
        </span>
      ) : null}
    </CollapsedRail>
  );
}
