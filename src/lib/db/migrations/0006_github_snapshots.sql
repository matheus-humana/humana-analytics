ALTER TYPE "analytics"."analytics_data_source_provider" ADD VALUE 'github';--> statement-breakpoint
CREATE TABLE "analytics"."github_repo_days" (
	"repo" text NOT NULL,
	"project_id" text NOT NULL,
	"day" date NOT NULL,
	"stars" integer NOT NULL,
	"forks" integer NOT NULL,
	"watchers" integer NOT NULL,
	"release_downloads" integer NOT NULL,
	"views_14d" integer NOT NULL,
	"unique_views_14d" integer NOT NULL,
	"clones_14d" integer NOT NULL,
	"unique_clones_14d" integer NOT NULL,
	"referrers" jsonb NOT NULL,
	"paths" jsonb NOT NULL,
	"assets" jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_repo_days_repo_day_pk" PRIMARY KEY("repo","day")
);
--> statement-breakpoint
CREATE TABLE "analytics"."github_traffic_days" (
	"repo" text NOT NULL,
	"project_id" text NOT NULL,
	"day" date NOT NULL,
	"views" integer,
	"unique_views" integer,
	"clones" integer,
	"unique_clones" integer,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_traffic_days_repo_day_pk" PRIMARY KEY("repo","day")
);
--> statement-breakpoint
ALTER TABLE "analytics"."github_repo_days" ADD CONSTRAINT "github_repo_days_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."github_traffic_days" ADD CONSTRAINT "github_traffic_days_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_repo_days_project_idx" ON "analytics"."github_repo_days" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "github_traffic_days_project_idx" ON "analytics"."github_traffic_days" USING btree ("project_id");