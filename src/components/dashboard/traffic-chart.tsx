import { trafficSeries } from "@/data/mock/dashboard";

export function TrafficChart() {
  const maxUsers = Math.max(...trafficSeries.map((point) => point.users));
  const chartHeight = 180;
  const chartWidth = 560;
  const paddingX = 28;
  const paddingY = 20;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;

  const points = trafficSeries.map((point, index) => {
    const x =
      paddingX +
      (trafficSeries.length === 1
        ? plotWidth / 2
        : (index / (trafficSeries.length - 1)) * plotWidth);
    const y =
      paddingY + plotHeight - (point.users / maxUsers) * plotHeight;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    paddingY + plotHeight
  } L ${points[0].x} ${paddingY + plotHeight} Z`;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <div className="mb-5">
        <h2 className="font-display text-base font-semibold text-foreground">
          Traffic
        </h2>
        <p className="mt-1 text-sm text-muted">
          Users over the last 7 days
        </p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 28}`}
          className="h-56 w-full min-w-[28rem]"
          role="img"
          aria-label="Users over the last 7 days"
        >
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6074c8" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#6074c8" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + plotHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={paddingX}
                x2={chartWidth - paddingX}
                y1={y}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth="1"
              />
            );
          })}

          <path d={areaPath} fill="url(#trafficFill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#6074c8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => (
            <g key={point.day}>
              <circle cx={point.x} cy={point.y} r="3.5" fill="#6074c8" />
              <text
                x={point.x}
                y={chartHeight + 18}
                textAnchor="middle"
                className="fill-[#5f5f5f] text-[11px]"
              >
                {point.day}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
