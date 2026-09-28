import { InfoTip } from "@/components/ui/info-tip";

export function RankList({
  title,
  info,
  empty,
  rows,
}: {
  title?: string;
  info?: string | null;
  empty: string;
  rows: Array<{ name: string; value: string; width: number }>;
}) {
  return (
    <section className="min-w-0">
      {title ? (
        <div className="mb-3 flex items-center gap-1">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {info ? <InfoTip text={info} /> : null}
        </div>
      ) : info ? (
        <p className="mb-3 text-xs text-muted">{info}</p>
      ) : null}
      {rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : null}
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.name}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{row.name}</span>
              <span className="shrink-0 tabular-nums text-muted">{row.value}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(0, Math.min(100, row.width))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
