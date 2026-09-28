import { KpiCard } from "@/components/ui/kpi-card";
import { RankList } from "@/components/ui/rank-list";
import type { VercelDashboardData } from "@/lib/vercel/fetch-report";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function sharePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10000) / 100;
}

type Props = {
  data: VercelDashboardData;
};

export function LiveVercelDashboard({ data }: Props) {
  const deviceTotal = data.devices.reduce((s, d) => s + d.value, 0);

  const citation = `Vercel · ${data.projectId} · ${data.periodLabel}`;

  return (
    <div className="space-y-6">
      <section className="grid gap-1 sm:grid-cols-2">
        <KpiCard
          label="Visitantes"
          value={formatNumber(data.overview.visitors)}
          citation={citation}
        />
        <KpiCard
          label="Pageviews"
          value={formatNumber(data.overview.pageviews)}
          citation={citation}
        />
      </section>

      <div className="grid gap-6">
        <Breakdown title="Caminhos" subtitle={`${citation} · Pageviews por requestPath`} items={data.topPaths} />
        <Breakdown
          title="Dispositivos"
          subtitle={`${citation} · Pageviews por device`}
          items={data.devices}
          showShare
          total={deviceTotal}
        />
        <Breakdown title="Referrers" subtitle={`${citation} · Origem do tráfego`} items={data.referrers} />
        <Breakdown title="Países" subtitle={`${citation} · Pageviews por país`} items={data.countries} />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  subtitle,
  items,
  showShare,
  total = 0,
}: {
  title: string;
  subtitle: string;
  items: Array<{ name: string; value: number }>;
  showShare?: boolean;
  total?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <RankList
      title={title}
      info={subtitle}
      empty="Sem dados no período."
      rows={items.map((item) => {
        const share = showShare ? sharePercent(item.value, total) : null;
        return {
          name: item.name,
          value: `${formatNumber(item.value)}${
            share != null ? ` · ${share.toFixed(1).replace(".", ",")}%` : ""
          }`,
          width: (item.value / max) * 100,
        };
      })}
    />
  );
}
