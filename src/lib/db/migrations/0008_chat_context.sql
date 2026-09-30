CREATE TABLE "analytics"."project_competitors" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"notes" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."project_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"url" text,
	"body" text,
	"confidential" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."project_profiles" (
	"project_id" text PRIMARY KEY NOT NULL,
	"site_url" text,
	"languages" text,
	"audience" text,
	"positioning" text,
	"goals" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics"."messages" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "analytics"."messages" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "analytics"."messages" ADD COLUMN "citations" jsonb;--> statement-breakpoint
ALTER TABLE "analytics"."messages" ADD COLUMN "used_fallback" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."project_competitors" ADD CONSTRAINT "project_competitors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."project_competitors" ADD CONSTRAINT "project_competitors_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "analytics"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."project_documents" ADD CONSTRAINT "project_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."project_documents" ADD CONSTRAINT "project_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "analytics"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."project_profiles" ADD CONSTRAINT "project_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "analytics"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."project_profiles" ADD CONSTRAINT "project_profiles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "analytics"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_competitors_project_id_idx" ON "analytics"."project_competitors" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_documents_project_id_idx" ON "analytics"."project_documents" USING btree ("project_id");