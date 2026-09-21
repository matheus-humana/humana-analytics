CREATE TYPE "analytics"."analytics_data_source_provider" AS ENUM('ga4', 'clarity', 'vercel');--> statement-breakpoint
CREATE TYPE "analytics"."analytics_data_source_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TABLE "analytics"."data_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"provider" "analytics"."analytics_data_source_provider" NOT NULL,
	"name" text NOT NULL,
	"status" "analytics"."analytics_data_source_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics"."data_sources" ADD CONSTRAINT "data_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_sources_project_id_idx" ON "analytics"."data_sources" USING btree ("project_id");