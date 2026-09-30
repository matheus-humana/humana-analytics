import { projectContextForModel } from "../context-input";
import { loadProjectContext } from "@/lib/projects/context-store";

export const contextToolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "get_project_context",
      description:
        "Qualitative project context: site, languages, audience, positioning, goals, competitors, and non-confidential documents. Never a source of numbers. Confidential documents are omitted.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
] as const;

export async function executeContextTool(projectId: string | null): Promise<unknown> {
  if (!projectId) {
    return {
      source: "Project context",
      qualitative: true,
      connected: false,
      instruction:
        "No project is selected. Say that project context is unavailable. Do not invent audience, competitors, or numbers.",
    };
  }

  const stored = await loadProjectContext(projectId);
  return projectContextForModel(stored, new Date().toISOString());
}
