CREATE TABLE "artifact_pin" (
	"conversation_id" integer NOT NULL,
	"artifact_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artifact_pin_conversation_id_artifact_id_pk" PRIMARY KEY("conversation_id","artifact_id")
);
--> statement-breakpoint
ALTER TABLE "artifact_pin" ADD CONSTRAINT "artifact_pin_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_pin" ADD CONSTRAINT "artifact_pin_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_pin" ADD CONSTRAINT "artifact_pin_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_pin_ownerId_idx" ON "artifact_pin" USING btree ("owner_id");