CREATE TABLE "library_item" (
	"id" integer GENERATED ALWAYS AS IDENTITY (sequence name "library_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entry_id" integer NOT NULL,
	"position" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"preview" text,
	"content" "bytea" NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "library_item_entry_id_position_pk" PRIMARY KEY("entry_id","position"),
	CONSTRAINT "library_item_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "library_item" ADD CONSTRAINT "library_item_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_item" ADD CONSTRAINT "library_item_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "library_item_ownerId_createdAt_idx" ON "library_item" USING btree ("owner_id","created_at");