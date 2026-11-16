CREATE TYPE "public"."conversation_visibility" AS ENUM('private', 'shared', 'family');--> statement-breakpoint
CREATE TABLE "conversation_member" (
	"conversation_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "conversation_member_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "visibility" "conversation_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_member" ADD CONSTRAINT "conversation_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_member_userId_idx" ON "conversation_member" USING btree ("user_id");