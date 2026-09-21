export type MetricCard = {
  id: string;
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
};

export type TrafficPoint = {
  day: string;
  users: number;
};

export type TopPage = {
  path: string;
  views: string;
};

export type AcquisitionSource = {
  source: string;
  share: string;
};

export const dashboardPeriodLabel = "Last 7 days";

export const metricCards: MetricCard[] = [
  {
    id: "users",
    label: "Users",
    value: "2,481",
    change: "+12.4%",
    trend: "up",
  },
  {
    id: "sessions",
    label: "Sessions",
    value: "3,120",
    change: "+8.1%",
    trend: "up",
  },
  {
    id: "page-views",
    label: "Page Views",
    value: "5,842",
    change: "+15.2%",
    trend: "up",
  },
  {
    id: "engagement",
    label: "Engagement Rate",
    value: "64.2%",
    change: "-1.3%",
    trend: "down",
  },
];

export const trafficSeries: TrafficPoint[] = [
  { day: "Mon", users: 312 },
  { day: "Tue", users: 368 },
  { day: "Wed", users: 421 },
  { day: "Thu", users: 390 },
  { day: "Fri", users: 455 },
  { day: "Sat", users: 267 },
  { day: "Sun", users: 268 },
];

export const topPages: TopPage[] = [
  { path: "/", views: "1,842" },
  { path: "/insights", views: "1,124" },
  { path: "/ebook", views: "843" },
  { path: "/contato", views: "521" },
];

export const acquisitionSources: AcquisitionSource[] = [
  { source: "Google", share: "42%" },
  { source: "Direct", share: "28%" },
  { source: "LinkedIn", share: "18%" },
  { source: "Other", share: "12%" },
];
