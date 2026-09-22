export const PERIOD_PARAMETER = {
  type: "string",
  enum: ["24h", "3d", "7d", "28d", "90d"],
  description:
    "Canonical product period. Omit this to use the interface default.",
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
