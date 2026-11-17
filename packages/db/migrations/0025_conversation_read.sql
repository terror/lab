ALTER TABLE "conversation" ADD COLUMN "read_at" timestamp;--> statement-breakpoint
UPDATE "conversation" SET "read_at" = "last_message_at";