CREATE TABLE "scheduled_task" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scheduled_task_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"owner_id" text NOT NULL,
	"conversation_id" integer,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"cron" text NOT NULL,
	"timezone" text NOT NULL,
	"description" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_task" ADD CONSTRAINT "scheduled_task_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_task" ADD CONSTRAINT "scheduled_task_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_task_ownerId_idx" ON "scheduled_task" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "scheduled_task_nextRunAt_idx" ON "scheduled_task" USING btree ("next_run_at");