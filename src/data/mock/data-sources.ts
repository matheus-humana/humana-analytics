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
  {
    id: "clarity",
    name: "Microsoft Clarity",
    status: "coming_soon",
    statusLabel: "Coming soon",
  },
  {
    id: "vercel",
    name: "Vercel Analytics",
    status: "coming_soon",
    statusLabel: "Coming soon",
  },
];

export const ga4ComingSoonMessage =
  "Google Analytics connection will be available soon.";
