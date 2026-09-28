import { InfoTip } from "@/components/ui/info-tip";
import { Sparkline } from "@/components/ui/sparkline";

export type KpiDelta = {
  text: string;
  direction: "up" | "down" | "flat";
  label: string;
};

type Props = {
  label: string;
  value: string;
  citation: string;
  delta?: KpiDelta | null;
  series?: Array<number | null> | null;
};

export function KpiCard({ label, value, citation, delta, series }: Props) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl bg-secondary px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        <InfoTip text={citation} />
      </div>
      <p className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight text-accent tabular-nums">
        {value}
      </p>
      {delta ? (
        <p
          className={`mt-2 w-fit rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
            delta.direction === "up"
              ? "bg-positive-bg text-positive"
              : delta.direction === "down"
                ? "bg-negative-bg text-negative"
                : "bg-secondary text-muted"
          }`}
          aria-label={`${delta.text} ${delta.label}`}
        >
          {delta.text}
        </p>
      ) : null}
      {series ? <Sparkline values={series} /> : null}
    </article>
  );
}
