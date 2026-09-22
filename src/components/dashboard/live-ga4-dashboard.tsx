import { Suspense } from "react";

import { PeriodFilter } from "@/components/analytics/period-filter";
import { SourceSwitcher } from "@/components/analytics/source-switcher";
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
    : "Dados demo";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div
            className={`mb-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${
              live
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-muted"
            }`}
          >
            {badge}
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Suspense
            fallback={
              <div className="h-9 w-40 animate-pulse rounded-lg bg-[#f1f1f1]" />
            }
          >
            <SourceSwitcher value={source} />
          </Suspense>
          <Suspense
            fallback={
              <div className="h-9 w-56 animate-pulse rounded-lg bg-[#f1f1f1]" />
            }
          >
            <PeriodFilter value={periodId} />
          </Suspense>
          <p className="text-xs text-muted">{periodLabel}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#cccccc] bg-[#f1f1f1] px-4 py-3 text-sm text-[#151515]">
          {errorPrefix}: {error}
        </div>
      ) : null}
    </div>
  );
}

type OverviewProps = {
  data: Ga4DashboardData["overview"];
};

export function OverviewHero({ data }: OverviewProps) {
  const hero = [
    { label: "Usuários ativos", value: formatNumber(data.activeUsers) },
    { label: "Novos usuários", value: formatNumber(data.newUsers) },
    {
      label: "Sessões engajadas",
      value: formatNumber(data.engagedSessions),
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {hero.map((item) => (
        <article
          key={item.label}
          className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5"
        >
          <p className="text-sm text-muted">{item.label}</p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-accent">
            {item.value}
          </p>
        </article>
      ))}
    </section>
  );
}

export function NavigationMetrics({ data }: OverviewProps) {
  const items = [
    { label: "Visualizações", value: formatNumber(data.views) },
    {
      label: "Visualizações por usuário ativo",
      value: data.viewsPerActiveUser.toFixed(2).replace(".", ","),
    },
    {
      label: "Tempo médio de engajamento",
      value: formatDuration(data.averageEngagementSeconds),
    },
    { label: "Taxa de rejeição", value: formatPercent(data.bounceRate) },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Navegação
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EventsCard({ eventCount }: { eventCount: number }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Eventos
      </h2>
      <p className="mt-1 text-sm text-muted">Contagem no período</p>
      <p className="mt-6 font-display text-4xl font-semibold tracking-tight text-accent">
        {formatNumber(eventCount)}
      </p>
    </section>
  );
}

export function ConversionsSection({
  items,
}: {
  items: Ga4DashboardData["conversions"];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Conversões e interações
      </h2>
      <p className="mt-1 text-sm text-muted">
        Eventos do site via GA4 (contato, newsletter, demo, download, login)
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.eventName}
            className="rounded-lg border border-border p-4"
            title={item.eventName}
          >
            <p className="font-display text-2xl font-semibold tracking-tight text-accent">
              {formatNumber(item.count)}
            </p>
            <p className="mt-1 text-xs text-muted">{item.label}</p>
          </div>
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
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>

      <ul className="mt-5 space-y-4">
        {items.length === 0 ? (
          <li className="text-sm text-muted">Sem dados no período.</li>
        ) : (
          items.map((item) => {
            const width = (item.value / max) * 100;
            const share = sharePercent(item.value, total);

            return (
              <li key={item.name}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-muted">
                    {formatNumber(item.value)}
                    {valueSuffix} · {share.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f1f1f1]">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

type LiveDashboardProps = {
  data: Ga4DashboardData;
};

export function LiveGa4Dashboard({ data }: LiveDashboardProps) {
  return (
    <div className="space-y-6">
      <OverviewHero data={data.overview} />
      <NavigationMetrics data={data.overview} />
      <ConversionsSection items={data.conversions} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <BreakdownList
          title="Principais páginas"
          subtitle="Visualizações por caminho"
          items={data.topPages}
          valueSuffix=" views"
        />
        <EventsCard eventCount={data.overview.eventCount} />
      </div>

      <TrafficChart series={data.traffic} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownList
          title="Usuários por navegador"
          subtitle="Active users"
          items={data.browsers}
        />
        <BreakdownList
          title="Usuários por sistema operacional"
          subtitle="Active users"
          items={data.operatingSystems}
        />
        <BreakdownList
          title="Usuários por categoria de plataforma"
          subtitle="Active users"
          items={data.platforms}
        />
        <BreakdownList
          title="Usuários por resolução de tela"
          subtitle="Active users"
          items={data.screenResolutions}
        />
      </div>
    </div>
  );
}
