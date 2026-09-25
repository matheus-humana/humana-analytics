import { redirect } from "next/navigation";

import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import {
  loadTrafficPayload,
  WorkspaceTraffic,
} from "@/components/workspace/workspace-traffic";
import { resolveDashboardSource } from "@/lib/analytics/dashboard-source";
import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { getSessionUser } from "@/lib/auth/require-user";
import { loadGithubPanel } from "@/lib/github/panel";
import { githubPeriodWindow, utcDay } from "@/lib/github/dates";
import { loadWorkspaceModel } from "@/lib/workspace/load-workspace";

type PageProps = {
  searchParams: Promise<{ period?: string; source?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const period = resolveAnalyticsPeriod(params.period);
  const source = resolveDashboardSource(params.source);
  const [model, traffic, github] = await Promise.all([
    loadWorkspaceModel(user.id),
    loadTrafficPayload(period, source),
    loadGithubPanel(period.id).catch((error: unknown) => {
      const today = utcDay(new Date());
      const window = githubPeriodWindow(period.id, today);
      return {
        configured: false,
        status: "error" as const,
        detail: error instanceof Error ? error.message : "GitHub panel failed",
        periodId: period.id,
        from: window.from,
        to: window.to,
        today,
        repos: [],
      };
    }),
  ]);

  return (
    <WorkspaceScreen
      userId={user.id}
      userName={user.name?.trim() || "Conta"}
      model={model}
      trafficSummary={traffic.summary}
      traffic={<WorkspaceTraffic payload={traffic} />}
      github={github}
    />
  );
}
