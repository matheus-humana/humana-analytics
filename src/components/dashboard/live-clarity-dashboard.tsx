import { InfoTip } from "@/components/ui/info-tip";
import { KpiCard } from "@/components/ui/kpi-card";
import { RankList } from "@/components/ui/rank-list";
import type { ClarityDashboardData } from "@/lib/clarity/fetch-report";

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatDecimal(value: number, digits = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${formatDecimal(value, 2)}%`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

function sharePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10000) / 100;
}

type Props = {
  data: ClarityDashboardData;
};

export function LiveClarityDashboard({ data }: Props) {
  const deviceTotal = data.devices.reduce((sum, d) => sum + d.value, 0);

  const userCards = [
    { label: "usuários únicos", value: formatNumber(data.users.uniqueUsers) },
    { label: "sessões", value: formatNumber(data.users.sessions) },
    {
      label: "sessões (bots reportados)",
      value: formatNumber(data.users.botSessions),
    },
  ];

  const behaviorCards = [
    {
      label: "páginas por sessão",
      value: formatDecimal(data.behavior.pagesPerSession, 2),
    },
    {
      label: "profundidade de rolagem",
      value: formatPercent(data.behavior.scrollDepthPercent),
    },
    {
      label: "tempo ativo",
      value: formatDuration(data.behavior.activeTimeSeconds),
    },
  ];

  const interactionRows = [
    { label: "Rage clicks", value: data.interactions.rageClicks },
    { label: "Dead clicks", value: data.interactions.deadClicks },
    { label: "Excessive scroll", value: data.interactions.excessiveScroll },
    { label: "Quickback clicks", value: data.interactions.quickbackClicks },
    { label: "Error clicks", value: data.interactions.errorClicks },
    { label: "Script errors", value: data.interactions.scriptErrors },
  ];

  const citation = `Clarity · ${data.projectId} · ${data.periodLabel}`;
  const clamp =
    "A API do Clarity só entrega até 3 dias. Períodos maiores usam essa janela máxima.";

  return (
    <div className="space-y-6">
      {data.periodClamped ? (
        <p className="flex items-center gap-1 text-sm text-muted">
          <span>Janela de 3 dias</span>
          <InfoTip text={clamp} />
        </p>
      ) : null}

      <section>
        <h2 className="mb-1 text-sm font-medium text-foreground">Usuários</h2>
        <div className="grid gap-1 sm:grid-cols-2">
          {userCards.map((item) => (
            <KpiCard key={item.label} label={item.label} value={item.value} citation={citation} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-foreground">Comportamento</h2>
        <div className="grid gap-1 sm:grid-cols-2">
          {behaviorCards.map((item) => (
            <KpiCard key={item.label} label={item.label} value={item.value} citation={citation} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center gap-1">
          <h2 className="text-sm font-medium text-foreground">Interação</h2>
          <InfoTip text={`${citation} · Sinais de fricção observados pelo Clarity`} />
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          {interactionRows.map((row) => (
            <KpiCard
              key={row.label}
              label={row.label}
              value={formatNumber(row.value)}
              citation={citation}
            />
          ))}
        </div>
      </section>

      <RankList
        title="Dispositivos"
        info={`${citation} · Sessões por tipo de device`}
        empty="Sem dados no período."
        rows={data.devices.map((item) => {
          const share = sharePercent(item.value, deviceTotal);
          return {
            name: item.name,
            value: `${formatNumber(item.value)} · ${share.toFixed(2).replace(".", ",")}%`,
            width: share,
          };
        })}
      />

      <RankList
        title="Páginas populares"
        info={`${citation} · URLs com mais sessões`}
        empty="Sem páginas no período."
        rows={data.popularPages.map((page) => {
          const max = Math.max(1, ...data.popularPages.map((item) => item.value));
          return {
            name: page.name,
            value: formatNumber(page.value),
            width: (page.value / max) * 100,
          };
        })}
      />
    </div>
  );
}
