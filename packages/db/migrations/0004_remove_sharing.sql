DROP TABLE "conversation_member" CASCADE;--> statement-breakpoint
ALTER TABLE "conversation" DROP COLUMN "visibility";--> statement-breakpoint
DROP TYPE "public"."conversation_visibility";