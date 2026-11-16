CREATE TABLE "spend_budget" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"monthly_limit" double precision NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spend_budget" ADD CONSTRAINT "spend_budget_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;