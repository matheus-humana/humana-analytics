import { Suspense } from "react";

import { PeriodFilter } from "@/components/analytics/period-filter";
import { SourceSwitcher } from "@/components/analytics/source-switcher";
import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard } from "@/components/ui/kpi-card";
import { RankList } from "@/components/ui/rank-list";
import type { DashboardSource } from "@/lib/analytics/dashboard-source";
import type { Ga4DashboardData, Ga4NamedCount } from "@/lib/ga4/fetch-report";
import { TrafficChart } from "@/components/dashboard/traffic-chart";
import type { AnalyticsPeriodId } from "@/lib/analytics/period";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

function sharePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

type HeaderProps = {
  live: boolean;
  periodLabel: string;
  periodId: AnalyticsPeriodId;
  source?: DashboardSource;
  error?: string | null;
};

export function DashboardHeader({
  live,
  periodLabel,
  periodId,
  source = "ga4",
  error,
}: HeaderProps) {
  const isClarity = source === "clarity";
  const isVercel = source === "vercel";

  const badge = live
    ? isClarity
      ? "Dados ao vivo · Clarity"
      : isVercel
        ? "Dados ao vivo · Vercel"
        : "Dados ao vivo · GA4"
    : "Sem dados ao vivo";

  const title = isClarity
    ? "Usabilidade e interação"
    : isVercel
      ? "Tráfego web (Vercel)"
      : "Aquisição e comportamento";

  const subtitle = isClarity
    ? "Sinais de comportamento e fricção do Microsoft Clarity."
    : isVercel
      ? "Visitantes, pageviews e origem via Vercel Web Analytics."
      : "Visão dos indicadores principais do site.";

  const errorPrefix = isClarity
    ? "Não foi possível carregar o Clarity"
    : isVercel
      ? "Não foi possível carregar o Vercel"
      : "Não foi possível carregar o GA4";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Suspense fallback={<div className="h-7 w-36 animate-pulse rounded-full bg-secondary" />}>
          <SourceSwitcher value={source} />
        </Suspense>
        <Suspense fallback={<div className="h-7 w-52 animate-pulse rounded-full bg-secondary" />}>
          <PeriodFilter value={periodId} />
        </Suspense>
        <InfoTip text={`${badge}. ${title}. ${subtitle} ${periodLabel}`} />
      </div>

      {error ? (
        <p className="text-sm text-foreground">
          {errorPrefix}: {error}
        </p>
      ) : null}
    </div>
  );
}

type OverviewProps = {
  data: Ga4DashboardData["overview"];
  citation: string;
  usersSeries?: Array<number | null>;
};

export function OverviewHero({ data, citation, usersSeries }: OverviewProps) {
  const hero = [
    { label: "Usuários ativos", value: formatNumber(data.activeUsers), series: usersSeries },
    { label: "Novos usuários", value: formatNumber(data.newUsers) },
    { label: "Sessões engajadas", value: formatNumber(data.engagedSessions) },
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

export function NavigationMetrics({ data, citation }: OverviewProps) {
  const items = [
    { label: "Visualizações", value: formatNumber(data.views) },
    {
      label: "Views / usuário",
      value: data.viewsPerActiveUser.toFixed(2).replace(".", ","),
    },
    {
      label: "Engajamento médio",
      value: formatDuration(data.averageEngagementSeconds),
    },
    { label: "Rejeição", value: formatPercent(data.bounceRate) },
  ];

  return (
    <section>
      <h2 className="mb-1 text-sm font-medium text-foreground">Navegação</h2>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <KpiCard key={item.label} label={item.label} value={item.value} citation={citation} />
        ))}
      </div>
    </section>
  );
}

export function EventsCard({
  eventCount,
  citation,
}: {
  eventCount: number;
  citation: string;
}) {
  return (
    <KpiCard
      label="Eventos"
      value={formatNumber(eventCount)}
      citation={`${citation} · Contagem no período`}
    />
  );
}

export function ConversionsSection({
  items,
  citation,
}: {
  items: Ga4DashboardData["conversions"];
  citation: string;
}) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-1">
        <h2 className="text-sm font-medium text-foreground">Conversões</h2>
        <InfoTip text={`Eventos do site via GA4. ${citation}`} />
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <KpiCard
            key={item.eventName}
            label={item.label}
            value={formatNumber(item.count)}
            citation={`${citation} · ${item.eventName}`}
          />
        ))}
      </div>
    </section>
  );
}

type BreakdownProps = {
  title: string;
  subtitle: string;
  items: Ga4NamedCount[];
  valueSuffix?: string;
};

export function BreakdownList({
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
      empty="Sem dados no período."
      rows={items.map((item) => ({
        name: item.name,
        value: `${formatNumber(item.value)}${valueSuffix} · ${sharePercent(item.value, total).toFixed(1).replace(".", ",")}%`,
        width: (item.value / max) * 100,
      }))}
    />
  );
}

type LiveDashboardProps = {
  data: Ga4DashboardData;
};

export function LiveGa4Dashboard({ data }: LiveDashboardProps) {
  const citation = `GA4 · ${data.propertyId} · ${data.periodLabel}`;
  const usersSeries = data.traffic.map((point) => point.users);
  return (
    <div className="space-y-6">
      <OverviewHero data={data.overview} citation={citation} usersSeries={usersSeries} />
      <NavigationMetrics data={data.overview} citation={citation} />
      <ConversionsSection items={data.conversions} citation={citation} />

      <div className="grid gap-6">
        <BreakdownList
          title="Principais páginas"
          subtitle={`${citation} · Visualizações por caminho`}
          items={data.topPages}
          valueSuffix=" views"
        />
        <EventsCard eventCount={data.overview.eventCount} citation={citation} />
      </div>

      <TrafficChart series={data.traffic} citation={citation} />

      <div className="grid gap-6">
        <BreakdownList
          title="Navegador"
          subtitle={`${citation} · Active users`}
          items={data.browsers}
        />
        <BreakdownList
          title="Sistema"
          subtitle={`${citation} · Active users`}
          items={data.operatingSystems}
        />
        <BreakdownList
          title="Plataforma"
          subtitle={`${citation} · Active users`}
          items={data.platforms}
        />
        <BreakdownList
          title="Resolução"
          subtitle={`${citation} · Active users`}
          items={data.screenResolutions}
        />
      </div>
    </div>
  );
}
