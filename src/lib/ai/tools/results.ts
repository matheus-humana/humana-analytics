import { redactSensitive } from "../redact";

export { notConnected } from "./tool-messages";

export function queryFailed(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  return {
    source,
    connected: true as const,
    instruction:
      "The source is connected but the query failed. Explain that to the user. Do not invent metrics.",
    error: redactSensitive(message),
  };
}

export function sourceUnavailable(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  return {
    source,
    connected: null,
    instruction:
      "This source could not be queried. If it is not connected, tell the user to connect it in Data Sources. Do not invent metrics.",
    error: redactSensitive(message),
  };
}
