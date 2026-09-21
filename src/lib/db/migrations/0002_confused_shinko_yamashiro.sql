CREATE TABLE "analytics"."data_source_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"data_source_id" text NOT NULL,
	"provider" "analytics"."analytics_data_source_provider" NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"scope" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics"."data_source_credentials" ADD CONSTRAINT "data_source_credentials_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "analytics"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "data_source_credentials_data_source_id_uidx" ON "analytics"."data_source_credentials" USING btree ("data_source_id");