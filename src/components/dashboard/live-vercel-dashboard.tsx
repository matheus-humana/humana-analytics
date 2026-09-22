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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <p className="text-sm text-muted">Visitantes</p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-accent">
            {formatNumber(data.overview.visitors)}
          </p>
        </article>
        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <p className="text-sm text-muted">Pageviews</p>
          <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-accent">
            {formatNumber(data.overview.pageviews)}
          </p>
        </article>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Principais caminhos"
          subtitle="Pageviews por requestPath"
          items={data.topPaths}
        />
        <Breakdown
          title="Dispositivos"
          subtitle="Pageviews por device"
          items={data.devices}
          showShare
          total={deviceTotal}
        />
        <Breakdown
          title="Referrers"
          subtitle="Origem do tráfego"
          items={data.referrers}
        />
        <Breakdown
          title="Países"
          subtitle="Pageviews por país"
          items={data.countries}
        />
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
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
      <ul className="mt-4 space-y-4">
        {items.length === 0 ? (
          <li className="text-sm text-muted">Sem dados no período.</li>
        ) : (
          items.map((item) => {
            const width = (item.value / max) * 100;
            const share = showShare ? sharePercent(item.value, total) : null;
            return (
              <li key={item.name}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-muted">
                    {formatNumber(item.value)}
                    {share != null
                      ? ` · ${share.toFixed(1).replace(".", ",")}%`
                      : null}
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
