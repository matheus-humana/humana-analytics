import { acquisitionSources } from "@/data/mock/dashboard";

export function Acquisition() {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Acquisition
      </h2>
      <p className="mt-1 text-sm text-muted">Where visitors came from</p>

      <ul className="mt-5 space-y-4">
        {acquisitionSources.map((item) => {
          const width = Number.parseInt(item.share, 10);

          return (
            <li key={item.source}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{item.source}</span>
                <span className="text-muted">{item.share}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f1f1f1]">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
