export type DateRange = {
  startDate: string;
  endDate: string;
};

export type DailyMetric = {
  date: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  engagementRate: number;
  newUsers: number;
  eventCount: number;
  keyEvents: number;
};

export type PageMetric = {
  date: string;
  pagePath: string;
  pageTitle: string;
  screenPageViews: number;
  activeUsers: number;
  engagementRate: number;
};

export type EventMetric = {
  date: string;
  eventName: string;
  eventCount: number;
  activeUsers: number;
  keyEvents: number;
};

export type TrafficSourceMetric = {
  date: string;
  source: string;
  medium: string;
  activeUsers: number;
  sessions: number;
};

export type AnalyticsReports = {
  daily: DailyMetric[];
  pages: PageMetric[];
  events: EventMetric[];
  trafficSources: TrafficSourceMetric[];
};

export type SyncCounts = {
  daily: number;
  pages: number;
  events: number;
  trafficSources: number;
};

export type OverviewMetrics = {
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  engagementRate: number;
  newUsers: number;
  eventCount: number;
  keyEvents: number;
};

export type AnalyticsAdapter = {
  provider: "google_analytics";
  validate(): Promise<{ ok: true; propertyId: string }>;
  fetchReports(range: DateRange): Promise<AnalyticsReports>;
};
