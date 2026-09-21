import { Acquisition } from "@/components/dashboard/acquisition";
import {
  DashboardHeader,
  MetricCards,
} from "@/components/dashboard/metric-cards";
import { TopPages } from "@/components/dashboard/top-pages";
import { TrafficChart } from "@/components/dashboard/traffic-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardHeader />
      <MetricCards />
      <TrafficChart />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopPages />
        <Acquisition />
      </div>
    </div>
  );
}
