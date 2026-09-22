export function notConnected(source: string) {
  return {
    source,
    connected: false as const,
    instruction: `${source} is not connected. Tell the user to open Data Sources and connect it. Do not invent metrics or substitute another source.`,
  };
}
