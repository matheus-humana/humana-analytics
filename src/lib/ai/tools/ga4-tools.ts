import { resolveAnalyticsPeriod } from "@/lib/analytics/period";
import { fetchGa4Dashboard } from "@/lib/ga4/fetch-report";

export const askAiToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_overview",
      description:
        "Retorna métricas gerais do GA4 no período: usuários ativos, novos usuários, sessões engajadas, visualizações, tempo médio, bounce rate e eventos.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["24h", "3d", "7d", "28d", "90d"],
            description: "Período canônico do produto.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_top_pages",
      description:
        "Retorna as páginas com mais visualizações (pagePath) no período.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["24h", "3d", "7d", "28d", "90d"],
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_tech_breakdown",
      description:
        "Retorna distribuição de usuários ativos por navegador, sistema operacional, plataforma ou resolução de tela.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["24h", "3d", "7d", "28d", "90d"],
          },
          dimension: {
            type: "string",
            enum: ["browser", "os", "platform", "resolution"],
            description: "Qual dimensão tecnológica retornar.",
          },
        },
        required: ["dimension"],
        additionalProperties: false,
      },
    },
  },
] as const;

type ToolArgs = {
  period?: string;
  dimension?: "browser" | "os" | "platform" | "resolution";
};

export async function executeAskAiTool(
  name: string,
  rawArgs: string,
  defaultPeriod: string
): Promise<unknown> {
  let args: ToolArgs = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as ToolArgs) : {};
  } catch {
    args = {};
  }

  const period = resolveAnalyticsPeriod(args.period ?? defaultPeriod).id;
  const dashboard = await fetchGa4Dashboard(period);

  switch (name) {
    case "get_overview":
      return {
        period: dashboard.periodLabel,
        propertyId: dashboard.propertyId,
        ...dashboard.overview,
      };
    case "get_top_pages":
      return {
        period: dashboard.periodLabel,
        pages: dashboard.topPages,
      };
    case "get_tech_breakdown": {
      const dimension = args.dimension ?? "browser";
      const map = {
        browser: dashboard.browsers,
        os: dashboard.operatingSystems,
        platform: dashboard.platforms,
        resolution: dashboard.screenResolutions,
      } as const;
      return {
        period: dashboard.periodLabel,
        dimension,
        items: map[dimension],
      };
    }
    default:
      return { error: `Tool desconhecida: ${name}` };
  }
}
