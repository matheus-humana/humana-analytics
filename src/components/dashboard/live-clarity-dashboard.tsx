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

  return (
    <div className="space-y-6">
      {data.periodClamped ? (
        <p className="rounded-lg border border-border bg-[#f1f1f1] px-4 py-3 text-sm text-foreground">
          A API do Clarity só entrega até 3 dias. Períodos maiores usam essa
          janela máxima.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Usuários
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {userCards.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border p-4"
            >
              <p className="font-display text-2xl font-semibold tracking-tight text-accent">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Comportamento
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {behaviorCards.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border p-4"
            >
              <p className="font-display text-2xl font-semibold tracking-tight text-accent">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-muted">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Interação
          </h2>
          <p className="mt-1 text-sm text-muted">
            Sinais de fricção observados pelo Clarity
          </p>
          <ul className="mt-4 space-y-3">
            {interactionRows.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <span className="text-foreground">{row.label}</span>
                <span className="font-semibold text-accent">
                  {formatNumber(row.value)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Dispositivos
          </h2>
          <p className="mt-1 text-sm text-muted">Sessões por tipo de device</p>
          <ul className="mt-4 space-y-4">
            {data.devices.length === 0 ? (
              <li className="text-sm text-muted">Sem dados no período.</li>
            ) : (
              data.devices.map((item) => {
                const share = sharePercent(item.value, deviceTotal);
                return (
                  <li key={item.name}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="text-muted">
                        {formatNumber(item.value)} ·{" "}
                        {share.toFixed(2).replace(".", ",")}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#f1f1f1]">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Páginas populares
        </h2>
        <p className="mt-1 text-sm text-muted">URLs com mais sessões</p>
        <ul className="mt-4 space-y-3">
          {data.popularPages.length === 0 ? (
            <li className="text-sm text-muted">Sem páginas no período.</li>
          ) : (
            data.popularPages.map((page) => (
              <li
                key={page.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="truncate font-medium text-foreground">
                  {page.name}
                </span>
                <span className="shrink-0 text-muted">
                  {formatNumber(page.value)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
