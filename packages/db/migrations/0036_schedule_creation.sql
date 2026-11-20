CREATE TABLE "scheduled_task_creation" (
	"task_id" integer NOT NULL,
	"owner_id" text NOT NULL,
	"scheduled_task_id" integer,
	CONSTRAINT "scheduled_task_creation_owner_id_task_id_pk" PRIMARY KEY("owner_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "scheduled_task_creation" ADD CONSTRAINT "scheduled_task_creation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_task_creation" ADD CONSTRAINT "scheduled_task_creation_scheduled_task_id_scheduled_task_id_fk" FOREIGN KEY ("scheduled_task_id") REFERENCES "public"."scheduled_task"("id") ON DELETE set null ON UPDATE no action;