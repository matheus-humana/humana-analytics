ALTER TABLE "analytics"."conversations" ADD COLUMN "assistant_status" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."messages" ADD COLUMN "reply_to_message_id" text;