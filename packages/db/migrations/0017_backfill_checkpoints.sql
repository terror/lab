CREATE TABLE "backfill_checkpoint" (
	"pipeline" text NOT NULL,
	"conversation_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	CONSTRAINT "backfill_checkpoint_pipeline_conversation_id_pk" PRIMARY KEY("pipeline","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "backfill_checkpoint" ADD CONSTRAINT "backfill_checkpoint_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_item_conversationId_idx" ON "library_item" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "usage_event_conversationId_idx" ON "usage_event" USING btree ("conversation_id");