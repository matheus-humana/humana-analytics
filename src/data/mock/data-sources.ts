export type DataSourceDemo = {
  id: string;
  name: string;
  status: "not_connected" | "coming_soon";
  statusLabel: string;
  actionLabel?: string;
};

export const dataSourcesDemo: DataSourceDemo[] = [
  {
    id: "ga4",
    name: "Google Analytics 4",
    status: "not_connected",
    statusLabel: "Not connected",
    actionLabel: "Connect",
  },
];

export const ga4ComingSoonMessage =
  "Google Analytics connection will be available soon.";
