ALTER TYPE "analytics"."analytics_data_source_provider" ADD VALUE 'pagespeed';--> statement-breakpoint
ALTER TYPE "analytics"."analytics_data_source_provider" ADD VALUE 'crawl';--> statement-breakpoint
CREATE TABLE "analytics"."crawl_pages" (
	"project_id" text NOT NULL,
	"day" date NOT NULL,
	"page_url" text NOT NULL,
	"http_status" integer NOT NULL,
	"title" text,
	"title_length" integer NOT NULL,
	"description" text,
	"description_length" integer NOT NULL,
	"h1_count" integer NOT NULL,
	"canonical" text,
	"lang" text,
	"hreflang" jsonb NOT NULL,
	"images_missing_alt" integer NOT NULL,
	"noindex" boolean NOT NULL,
	"json_ld_types" jsonb NOT NULL,
	"word_count" integer NOT NULL,
	"sentence_count" integer NOT NULL,
	"heading_skips" integer NOT NULL,
	CONSTRAINT "crawl_pages_project_id_day_page_url_pk" PRIMARY KEY("project_id","day","page_url")
);
--> statement-breakpoint
CREATE TABLE "analytics"."crawl_snapshots" (
	"project_id" text NOT NULL,
	"day" date NOT NULL,
	"site_url" text NOT NULL,
	"pages_fetched" integer NOT NULL,
	"pages_planned" integer NOT NULL,
	"complete" boolean NOT NULL,
	"sitemap_found" boolean NOT NULL,
	"sitemap_urls" integer NOT NULL,
	"robots_found" boolean NOT NULL,
	"robots_bytes" integer NOT NULL,
	"llms_found" boolean NOT NULL,
	"llms_bytes" integer NOT NULL,
	"llms_valid" boolean NOT NULL,
	"geo_score_points" integer NOT NULL,
	"checklist" jsonb NOT NULL,
	"ai_bots" jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crawl_snapshots_project_id_day_pk" PRIMARY KEY("project_id","day")
);
--> statement-breakpoint
CREATE TABLE "analytics"."pagespeed_snapshots" (
	"project_id" text NOT NULL,
	"page_url" text NOT NULL,
	"strategy" text NOT NULL,
	"day" date NOT NULL,
	"performance" integer,
	"accessibility" integer,
	"best_practices" integer,
	"seo" integer,
	"lcp_ms" integer,
	"cls_thousandths" integer,
	"inp_ms" integer,
	"lcp_origin" text,
	"cls_origin" text,
	"inp_origin" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagespeed_snapshots_project_id_page_url_strategy_day_pk" PRIMARY KEY("project_id","page_url","strategy","day")
);
--> statement-breakpoint
CREATE TABLE "analytics"."seo_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"ok" boolean NOT NULL,
	"detail" text,
	"page_url" text,
	"strategy" text,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."site_findings" (
	"project_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"severity" text NOT NULL,
	"code" text NOT NULL,
	"page_url" text NOT NULL,
	"detail" text NOT NULL,
	"status" text NOT NULL,
	"first_seen_on" date NOT NULL,
	"last_seen_on" date NOT NULL,
	"resolved_on" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_findings_project_id_fingerprint_pk" PRIMARY KEY("project_id","fingerprint")
);
--> statement-breakpoint
ALTER TABLE "analytics"."crawl_pages" ADD CONSTRAINT "crawl_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."crawl_snapshots" ADD CONSTRAINT "crawl_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."pagespeed_snapshots" ADD CONSTRAINT "pagespeed_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."seo_runs" ADD CONSTRAINT "seo_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."site_findings" ADD CONSTRAINT "site_findings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawl_snapshots_project_idx" ON "analytics"."crawl_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pagespeed_snapshots_project_day_idx" ON "analytics"."pagespeed_snapshots" USING btree ("project_id","day");--> statement-breakpoint
CREATE INDEX "seo_runs_project_kind_idx" ON "analytics"."seo_runs" USING btree ("project_id","kind","finished_at");--> statement-breakpoint
CREATE INDEX "site_findings_project_status_idx" ON "analytics"."site_findings" USING btree ("project_id","status");