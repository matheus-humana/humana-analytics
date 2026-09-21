import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const analyticsProvider = pgEnum("analytics_provider", [
  "google_analytics",
  "microsoft_clarity",
  "vercel_analytics",
]);

export const dataSourceStatus = pgEnum("data_source_status", [
  "pending",
  "connected",
  "error",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("projects_organization_name_idx").on(
      table.organizationId,
      table.name,
    ),
  ],
);

export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    provider: analyticsProvider("provider").notNull(),
    name: text("name").notNull(),
    externalId: text("external_id").notNull(),
    status: dataSourceStatus("status").notNull().default("pending"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("data_sources_project_provider_external_idx").on(
      table.projectId,
      table.provider,
      table.externalId,
    ),
  ],
);

export const dataSourceCredentials = pgTable(
  "data_source_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    authType: text("auth_type").notNull(),
    configRef: text("config_ref").notNull(),
    principal: text("principal"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("data_source_credentials_source_idx").on(table.dataSourceId),
  ],
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    activeUsers: integer("active_users").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    screenPageViews: integer("screen_page_views").notNull().default(0),
    engagementRate: doublePrecision("engagement_rate").notNull().default(0),
    newUsers: integer("new_users").notNull().default(0),
    eventCount: integer("event_count").notNull().default(0),
    keyEvents: integer("key_events").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique("analytics_daily_source_date").on(table.dataSourceId, table.date),
    index("analytics_daily_source_date_idx").on(
      table.dataSourceId,
      table.date,
    ),
  ],
);

export const analyticsPages = pgTable(
  "analytics_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    pagePath: text("page_path").notNull(),
    pageTitle: text("page_title").notNull().default(""),
    screenPageViews: integer("screen_page_views").notNull().default(0),
    activeUsers: integer("active_users").notNull().default(0),
    engagementRate: doublePrecision("engagement_rate").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique("analytics_pages_source_date_path").on(
      table.dataSourceId,
      table.date,
      table.pagePath,
    ),
    index("analytics_pages_source_date_idx").on(table.dataSourceId, table.date),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    eventName: text("event_name").notNull(),
    eventCount: integer("event_count").notNull().default(0),
    activeUsers: integer("active_users").notNull().default(0),
    keyEvents: integer("key_events").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique("analytics_events_source_date_name").on(
      table.dataSourceId,
      table.date,
      table.eventName,
    ),
    index("analytics_events_source_date_idx").on(
      table.dataSourceId,
      table.date,
    ),
  ],
);

export const analyticsTrafficSources = pgTable(
  "analytics_traffic_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    source: text("source").notNull(),
    medium: text("medium").notNull(),
    activeUsers: integer("active_users").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    unique("analytics_traffic_sources_source_date_source_medium").on(
      table.dataSourceId,
      table.date,
      table.source,
      table.medium,
    ),
    index("analytics_traffic_sources_source_date_idx").on(
      table.dataSourceId,
      table.date,
    ),
  ],
);

export const analyticsSyncRuns = pgTable(
  "analytics_sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    rowsUpserted: jsonb("rows_upserted").$type<Record<string, number>>(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("analytics_sync_runs_source_started_idx").on(
      table.dataSourceId,
      table.startedAt,
    ),
  ],
);
