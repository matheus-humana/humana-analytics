const SIZE = 48;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Lighthouse bands: 90–100 good, 50–89 needs improvement, 0–49 poor. */
function ringColor(score: number | null): string {
  if (score == null) return "var(--color-secondary)";
  if (score >= 90) return "#0cce6b";
  if (score >= 50) return "#ffa400";
  return "#ff4e42";
}

export function ScoreRing({
  label,
  score,
  title,
}: {
  label: string;
  score: number | null;
  title?: string;
}) {
  const value = score == null ? 0 : Math.max(0, Math.min(100, score));
  const color = ringColor(score);
  return (
    <div className="flex flex-col items-center gap-1.5 text-center" title={title}>
      <div className="relative h-12 w-12">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-12 w-12 -rotate-90" aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-secondary)"
            strokeWidth={STROKE}
          />
          {score != null ? (
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - value / 100)}
            />
          ) : null}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-foreground">
          {score == null ? "—" : score}
        </span>
      </div>
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
}
