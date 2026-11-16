DROP INDEX "conversation_ownerId_createdAt_idx";--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "last_message_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "conversation" SET "last_message_at" = "created_at";--> statement-breakpoint
CREATE INDEX "conversation_ownerId_lastMessageAt_idx" ON "conversation" USING btree ("owner_id","last_message_at");