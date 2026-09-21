import { redirect } from "next/navigation";

<<<<<<< HEAD
export default function HomePage() {
  redirect("/dashboard");
=======
export const dynamic = "force-dynamic";

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatPercent(value: number | null | undefined) {
  return `${((value ?? 0) * 100).toFixed(1)}%`;
}

function formatChange(value: number | null | undefined) {
  const amount = value ?? 0;
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatPercent(amount)}`;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
      }`}
    >
      {label}
    </span>
  );
}

export default async function Home() {
  const setup = {
    database: Boolean(getDatabaseUrl()),
    propertyId: getGa4PropertyId() ?? null,
    credentials: getCredentialStatus(),
  };

  let error: string | null = null;
  let metrics: Awaited<ReturnType<typeof getPersistedMetrics>> | null = null;

  if (setup.database) {
    try {
      metrics = await getPersistedMetrics(getDb());
    } catch (caught) {
      error = publicErrorMessage(caught);
    }
  }

  const overview = metrics?.overview;
  const comparison = metrics?.comparison;

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-10 font-sans dark:bg-black">
      <main className="flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Humana Analytics
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            GA4 → PostgreSQL
          </h1>
          <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
            Local collector for core Google Analytics 4 reports. Metrics land in
            Postgres and can later be queried by the analytics agent.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-medium text-zinc-500">Database</h2>
            <div className="mt-3">
              <StatusPill
                ok={setup.database && !error}
                label={
                  !setup.database
                    ? "DATABASE_URL missing"
                    : error
                      ? "Connection failed"
                      : "Configured"
                }
              />
            </div>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-medium text-zinc-500">GA4 property</h2>
            <p className="mt-3 font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {setup.propertyId ?? "GA4_PROPERTY_ID missing"}
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-medium text-zinc-500">Credentials</h2>
            <p className="mt-3 text-sm text-zinc-900 dark:text-zinc-100">
              {setup.credentials.configured
                ? `Using ${setup.credentials.source}`
                : "No service account configured"}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <h2 className="text-lg font-semibold">Sync</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Last run:{" "}
                {metrics?.lastSync
                  ? `${metrics.lastSync.status} · ${metrics.lastSync.startDate} → ${metrics.lastSync.endDate}`
                  : "none yet"}
              </p>
              {error ? (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                  {error}
                </p>
              ) : null}
            </div>
            <SyncButton fixtureEnabled={allowFixtureSync()} />
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            CLI: <code>pnpm db:migrate</code> then <code>pnpm ga4:sync</code>.
            Setup notes are in <code>docs/GA4.md</code>.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Users", formatNumber(overview?.activeUsers)],
            ["Sessions", formatNumber(overview?.sessions)],
            ["Views", formatNumber(overview?.screenPageViews)],
            ["Key events", formatNumber(overview?.keyEvents)],
          ].map(([label, value]) => (
            <article
              key={label}
              className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="text-sm text-zinc-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </article>
          ))}
        </section>

        {comparison && comparison.previous.metrics.sessions > 0 ? (
          <p className="text-sm text-zinc-500">
            vs previous period: users {formatChange(comparison.change.activeUsers)} ·
            sessions {formatChange(comparison.change.sessions)} · views{" "}
            {formatChange(comparison.change.screenPageViews)}
          </p>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <MetricTable
            title="Top pages"
            headers={["Page", "Views", "Users"]}
            rows={(metrics?.pages ?? []).map((row) => [
              row.pagePath,
              formatNumber(row.screenPageViews),
              formatNumber(row.activeUsers),
            ])}
          />
          <MetricTable
            title="Traffic sources"
            headers={["Source / medium", "Sessions", "Users"]}
            rows={(metrics?.trafficSources ?? []).map((row) => [
              `${row.source} / ${row.medium}`,
              formatNumber(row.sessions),
              formatNumber(row.activeUsers),
            ])}
          />
          <MetricTable
            title="Events"
            headers={["Event", "Count", "Key events"]}
            rows={(metrics?.events ?? []).map((row) => [
              row.eventName,
              formatNumber(row.eventCount),
              formatNumber(row.keyEvents),
            ])}
          />
          <MetricTable
            title="Daily"
            headers={["Date", "Users", "Sessions"]}
            rows={(metrics?.daily ?? []).map((row) => [
              row.date,
              formatNumber(row.activeUsers),
              formatNumber(row.sessions),
            ])}
          />
        </section>
      </main>
    </div>
  );
}

function MetricTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No persisted rows yet.</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="text-zinc-500">
              {headers.map((header) => (
                <th key={header} className="pb-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("-")} className="border-t border-zinc-100 dark:border-zinc-800">
                {row.map((cell) => (
                  <td key={cell} className="py-2 font-mono text-xs sm:text-sm">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
>>>>>>> 31aef18 (fix: keep dashboard sync controls stable after fixture loads)
}
