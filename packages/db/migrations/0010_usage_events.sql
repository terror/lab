CREATE TABLE "usage_event" (
	"entry_id" integer PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"input" integer NOT NULL,
	"output" integer NOT NULL,
	"cache_read" integer NOT NULL,
	"cache_write" integer NOT NULL,
	"cost" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_event_ownerId_createdAt_idx" ON "usage_event" USING btree ("owner_id","created_at");