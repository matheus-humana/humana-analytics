CREATE TABLE "analytics"."analytics_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"data_source_id" text NOT NULL,
	"date" date NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"screen_page_views" integer DEFAULT 0 NOT NULL,
	"engagement_rate" double precision DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"key_events" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_source_date" UNIQUE("data_source_id","date")
);
--> statement-breakpoint
CREATE TABLE "analytics"."analytics_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"data_source_id" text NOT NULL,
	"date" date NOT NULL,
	"page_path" text NOT NULL,
	"page_title" text DEFAULT '' NOT NULL,
	"screen_page_views" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"engagement_rate" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_pages_source_date_path" UNIQUE("data_source_id","date","page_path")
);
--> statement-breakpoint
CREATE TABLE "analytics"."analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"data_source_id" text NOT NULL,
	"date" date NOT NULL,
	"event_name" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"key_events" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_events_source_date_name" UNIQUE("data_source_id","date","event_name")
);
--> statement-breakpoint
CREATE TABLE "analytics"."analytics_traffic_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"data_source_id" text NOT NULL,
	"date" date NOT NULL,
	"source" text NOT NULL,
	"medium" text NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_traffic_sources_source_date_source_medium" UNIQUE("data_source_id","date","source","medium")
);
--> statement-breakpoint
CREATE TABLE "analytics"."analytics_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"data_source_id" text NOT NULL,
	"status" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"rows_upserted" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "analytics"."analytics_daily" ADD CONSTRAINT "analytics_daily_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."analytics_pages" ADD CONSTRAINT "analytics_pages_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."analytics_events" ADD CONSTRAINT "analytics_events_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."analytics_traffic_sources" ADD CONSTRAINT "analytics_traffic_sources_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."analytics_sync_runs" ADD CONSTRAINT "analytics_sync_runs_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_daily_source_date_idx" ON "analytics"."analytics_daily" USING btree ("data_source_id","date");--> statement-breakpoint
CREATE INDEX "analytics_pages_source_date_idx" ON "analytics"."analytics_pages" USING btree ("data_source_id","date");--> statement-breakpoint
CREATE INDEX "analytics_events_source_date_idx" ON "analytics"."analytics_events" USING btree ("data_source_id","date");--> statement-breakpoint
CREATE INDEX "analytics_traffic_sources_source_date_idx" ON "analytics"."analytics_traffic_sources" USING btree ("data_source_id","date");--> statement-breakpoint
CREATE INDEX "analytics_sync_runs_source_started_idx" ON "analytics"."analytics_sync_runs" USING btree ("data_source_id","started_at");
