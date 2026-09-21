import { topPages } from "@/data/mock/dashboard";

export function TopPages() {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Top Pages
      </h2>
      <p className="mt-1 text-sm text-muted">Most viewed pages this week</p>

      <ul className="mt-5 divide-y divide-border">
        {topPages.map((page) => (
          <li
            key={page.path}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <code className="rounded bg-[#f1f1f1] px-2 py-1 text-sm text-foreground">
              {page.path}
            </code>
            <span className="text-sm text-muted">{page.views} views</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
