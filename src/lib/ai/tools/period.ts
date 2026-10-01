export const PERIOD_PARAMETER = {
  type: "string",
  enum: ["24h", "3d", "7d", "28d", "90d"],
  description:
    "Period named in the user's question: 24h (today), 3d, 7d, 28d, or 90d. Omit only when the question names no period; the default is the last 7 days.",
} as const;

export function parseToolArgs(rawArgs: string): {
  period?: string;
  dimension?: "browser" | "os" | "platform" | "resolution";
} {
  try {
    return rawArgs
      ? (JSON.parse(rawArgs) as {
          period?: string;
          dimension?: "browser" | "os" | "platform" | "resolution";
        })
      : {};
  } catch {
    return {};
  }
}
