import { Suspense, type ReactNode } from "react";

import { PeriodFilter } from "@/components/analytics/period-filter";
import { TrafficChart } from "@/components/dashboard/traffic-chart";
import { Disclosure } from "@/components/ui/disclosure";
import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard } from "@/components/ui/kpi-card";
import { RankList } from "@/components/ui/rank-list";
import type { ChatLocale } from "@/lib/ai/analytics-bot-contract";
import type { AnalyticsPeriodId } from "@/lib/analytics/period";
import type { Ga4DashboardData, Ga4NamedCount } from "@/lib/ga4/fetch-report";
import {
  formatCount,
  formatDecimal,
  formatRatePercent,
  formatShare,
} from "@/lib/i18n/format";
import { localizeKnownCopy } from "@/lib/i18n/known-copy";
import { periodLabel } from "@/lib/i18n/period-label";
import { workspaceCopy, workspaceText, type WorkspaceMessageKey } from "@/lib/i18n/workspace-copy";

const CONVERSION_LABELS: Record<string, WorkspaceMessageKey> = {
  contact: "conversionContact",
  sign_up: "conversionSignUp",
  generate_lead: "conversionLead",
  file_download: "conversionDownload",
  app_login: "conversionLogin",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

type HeaderProps = {
  locale: ChatLocale;
  periodId: AnalyticsPeriodId;
  error?: string | null;
  freshness?: ReactNode;
};

export function DashboardHeader({ locale, periodId, error, freshness }: HeaderProps) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const period = periodLabel(locale, periodId);
  const shownError = error ? formatGa4Error(error, locale, text) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Suspense fallback={<div className="h-7 w-52 animate-pulse rounded-full bg-secondary" />}>
          <PeriodFilter value={periodId} />
        </Suspense>
        {freshness}
        <InfoTip text={`${text("ga4Tip")} ${period}`} />
      </div>

      {shownError ? <p className="text-sm text-foreground">{shownError}</p> : null}
    </div>
  );
}

function formatGa4Error(
  error: string,
  locale: ChatLocale,
  text: (key: WorkspaceMessageKey) => string
): string {
  const known = localizeKnownCopy(error, locale);
  if (
    known !== error ||
    error === workspaceCopy["pt-BR"].ga4LoadFailed ||
    error === workspaceCopy.en.ga4LoadFailed
  ) {
    return known;
  }
  return `${text("ga4LoadError")}: ${known}`;
}

type OverviewProps = {
  locale: ChatLocale;
  data: Ga4DashboardData["overview"];
  citation: string;
  usersSeries?: Array<number | null>;
};

export function OverviewHero({ locale, data, citation, usersSeries }: OverviewProps) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const hero = [
    {
      label: text("ga4ActiveUsers"),
      value: formatCount(data.activeUsers, locale),
      series: usersSeries,
    },
    { label: text("ga4NewUsers"), value: formatCount(data.newUsers, locale) },
    { label: text("ga4EngagedSessions"), value: formatCount(data.engagedSessions, locale) },
  ];

  return (
    <section className="grid gap-1 sm:grid-cols-3">
      {hero.map((item) => (
        <KpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          citation={citation}
          series={item.series}
        />
      ))}
    </section>
  );
}

export function NavigationMetrics({ locale, data, citation }: OverviewProps) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const items = [
    { label: text("ga4Views"), value: formatCount(data.views, locale) },
    {
      label: text("ga4ViewsPerUser"),
      value: formatDecimal(data.viewsPerActiveUser, locale),
    },
    {
      label: text("ga4AvgEngagement"),
      value: formatDuration(data.averageEngagementSeconds),
    },
    { label: text("ga4Bounce"), value: formatRatePercent(data.bounceRate, locale) },
  ];

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium text-foreground">{text("ga4Navigation")}</h2>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} citation={citation} />
        ))}
      </div>
    </section>
  );
}

export function EventsCard({
  locale,
  eventCount,
  citation,
}: {
  locale: ChatLocale;
  eventCount: number;
  citation: string;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  return (
    <KpiCard
      label={text("ga4Events")}
      value={formatCount(eventCount, locale)}
      citation={`${citation} · ${text("ga4CountInPeriod")}`}
    />
  );
}

export function ConversionsSection({
  locale,
  items,
  citation,
}: {
  locale: ChatLocale;
  items: Ga4DashboardData["conversions"];
  citation: string;
}) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  return (
    <section>
      <div className="mb-1 flex items-center gap-1">
        <h2 className="text-sm font-medium text-foreground">{text("ga4Conversions")}</h2>
        <InfoTip text={`${text("ga4ConversionTip")} ${citation}`} />
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => {
          const key = CONVERSION_LABELS[item.eventName];
          return (
            <KpiCard
              key={item.eventName}
              label={key ? text(key) : item.eventName}
              value={formatCount(item.count, locale)}
              citation={`${citation} · ${item.eventName}`}
            />
          );
        })}
      </div>
    </section>
  );
}

type BreakdownProps = {
  locale: ChatLocale;
  title: string;
  subtitle: string;
  items: Ga4NamedCount[];
  valueSuffix?: string;
};

export function BreakdownList({
  locale,
  title,
  subtitle,
  items,
  valueSuffix = "",
}: BreakdownProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <RankList
      title={title}
      info={subtitle}
      empty={workspaceText(locale, "ga4Empty")}
      rows={items.map((item) => ({
        name: item.name,
        value: `${formatCount(item.value, locale)}${valueSuffix} · ${formatShare(item.value, total, locale)}%`,
        width: (item.value / max) * 100,
      }))}
    />
  );
}

type LiveDashboardProps = {
  data: Ga4DashboardData;
  locale: ChatLocale;
  periodId: AnalyticsPeriodId;
};

export function LiveGa4Dashboard({ data, locale, periodId }: LiveDashboardProps) {
  const text = (key: WorkspaceMessageKey) => workspaceText(locale, key);
  const citation = `GA4 · ${data.propertyId} · ${periodLabel(locale, periodId)}`;
  const usersSeries = data.traffic.map((point) => point.users);
  const users = text("ga4ActiveUsers");
  return (
    <div className="space-y-6">
      <OverviewHero
        locale={locale}
        data={data.overview}
        citation={citation}
        usersSeries={usersSeries}
      />
      <NavigationMetrics locale={locale} data={data.overview} citation={citation} />
      <ConversionsSection locale={locale} items={data.conversions} citation={citation} />

      <div className="grid gap-6">
        <BreakdownList
          locale={locale}
          title={text("ga4TopPages")}
          subtitle={`${citation} · ${text("ga4ViewsByPath")}`}
          items={data.topPages}
          valueSuffix={text("ga4ViewsSuffix")}
        />
        <EventsCard locale={locale} eventCount={data.overview.eventCount} citation={citation} />
      </div>

      <TrafficChart locale={locale} series={data.traffic} citation={citation} />

      <Disclosure title={text("ga4VisitorTech")}>
        <BreakdownList
          locale={locale}
          title={text("ga4Browser")}
          subtitle={`${citation} · ${users}`}
          items={data.browsers}
        />
        <BreakdownList
          locale={locale}
          title={text("ga4Os")}
          subtitle={`${citation} · ${users}`}
          items={data.operatingSystems}
        />
        <BreakdownList
          locale={locale}
          title={text("ga4Platform")}
          subtitle={`${citation} · ${users}`}
          items={data.platforms}
        />
        <BreakdownList
          locale={locale}
          title={text("ga4Resolution")}
          subtitle={`${citation} · ${users}`}
          items={data.screenResolutions}
        />
      </Disclosure>
    </div>
  );
}
