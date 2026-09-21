import { DataSourcesPanel } from "@/components/data-sources/data-sources-panel";
import { Ga4SyncPanel } from "@/components/data-sources/ga4-sync-panel";

export const dynamic = "force-dynamic";

export default function DataSourcesPage() {
  return (
    <div className="space-y-6">
      <Ga4SyncPanel />
      <DataSourcesPanel />
    </div>
  );
}
