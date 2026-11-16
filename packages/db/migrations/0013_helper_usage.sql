ALTER TABLE "usage_event" DROP CONSTRAINT "usage_event_pkey";--> statement-breakpoint
ALTER TABLE "usage_event" ALTER COLUMN "entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_event" ADD COLUMN "id" integer PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "usage_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "usage_event" ADD COLUMN "kind" text DEFAULT 'response' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_entry_id_unique" UNIQUE("entry_id");
