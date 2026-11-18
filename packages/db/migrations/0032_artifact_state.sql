CREATE TABLE "artifact_state" (
	"conversation_id" integer NOT NULL,
	"artifact_id" text NOT NULL,
	"key" text NOT NULL,
	"owner_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "artifact_state_conversation_id_artifact_id_key_pk" PRIMARY KEY("conversation_id","artifact_id","key")
);
--> statement-breakpoint
ALTER TABLE "artifact_state" ADD CONSTRAINT "artifact_state_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_state" ADD CONSTRAINT "artifact_state_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_state_ownerId_idx" ON "artifact_state" USING btree ("owner_id");