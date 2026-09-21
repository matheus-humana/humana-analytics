import { SyncButton } from "@/components/sync-button";
import { getPersistedMetrics } from "@/lib/analytics/queries";
import { getDb } from "@/lib/db";
import {
  allowFixtureSync,
  getCredentialStatus,
  getDatabaseUrl,
  getGa4PropertyId,
} from "@/lib/env";
import { publicErrorMessage } from "@/lib/errors";

export async function Ga4SyncPanel() {
  const setup = {
    database: Boolean(getDatabaseUrl()),
    propertyId: getGa4PropertyId() ?? null,
    credentials: getCredentialStatus(),
  };

  let error: string | null = null;
  let lastSync: string | null = null;

  if (setup.database) {
    try {
      const metrics = await getPersistedMetrics(getDb());
      lastSync = metrics.lastSync
        ? `${metrics.lastSync.status} · ${metrics.lastSync.startDate} → ${metrics.lastSync.endDate}`
        : null;
    } catch (caught) {
      error = publicErrorMessage(caught);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm shadow-black/5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            GA4 → PostgreSQL
          </h2>
          <p className="mt-1 text-sm text-muted">
            Service-account sync of core reports into the `analytics` schema.
          </p>
          <dl className="mt-4 space-y-1 text-sm text-muted">
            <div>
              Database: {setup.database ? "configured" : "DATABASE_URL missing"}
            </div>
            <div>
              Property: {setup.propertyId ?? "GA4_PROPERTY_ID missing"}
            </div>
            <div>
              Credentials:{" "}
              {setup.credentials.configured
                ? `using ${setup.credentials.source}`
                : "no service account configured"}
            </div>
            <div>Last sync: {lastSync ?? "none yet"}</div>
          </dl>
          {error ? (
            <p className="mt-2 text-sm text-amber-700">{error}</p>
          ) : null}
        </div>
        <SyncButton fixtureEnabled={allowFixtureSync()} />
      </div>
    </section>
  );
}
