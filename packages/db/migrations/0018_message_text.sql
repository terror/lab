CREATE TABLE "message_text" (
	"entry_id" integer PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"owner_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_text" ADD CONSTRAINT "message_text_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_text" ADD CONSTRAINT "message_text_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_text_search_idx" ON "message_text" USING gin ("search");--> statement-breakpoint
CREATE INDEX "message_text_conversationId_idx" ON "message_text" USING btree ("conversation_id","entry_id");