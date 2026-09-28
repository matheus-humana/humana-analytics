type Props = {
  values: Array<number | null>;
};

/**
 * Lightweight stand-in for a Tremor sparkline.
 * Nulls are gaps (a missing day is not drawn as zero).
 */
export function Sparkline({ values }: Props) {
  const known = values.filter((value): value is number => value != null);
  if (known.length < 2) return null;

  const width = 128;
  const height = 36;
  const pad = 2;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = max - min || 1;
  const xAt = (index: number) =>
    values.length <= 1
      ? width / 2
      : pad + (index / (values.length - 1)) * (width - pad * 2);
  const yAt = (value: number) =>
    pad + (1 - (value - min) / span) * (height - pad * 2);

  let line = "";
  values.forEach((value, index) => {
    if (value == null) return;
    const previous = index > 0 ? values[index - 1] : null;
    const command = previous == null ? "M" : "L";
    line += `${command} ${xAt(index)} ${yAt(value)} `;
  });

  const firstIndex = values.findIndex((value) => value != null);
  const lastIndex = values.findLastIndex((value) => value != null);
  if (firstIndex < 0 || lastIndex < 0) return null;
  const area = `${line} L ${xAt(lastIndex)} ${height - pad} L ${xAt(firstIndex)} ${height - pad} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1 h-9 w-full"
      aria-hidden
    >
      <path d={area} fill="var(--accent)" opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
