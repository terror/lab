CREATE TABLE "connector_auth" (
	"connector_id" integer PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_auth" ADD CONSTRAINT "connector_auth_connector_id_connector_id_fk" FOREIGN KEY ("connector_id") REFERENCES "public"."connector"("id") ON DELETE cascade ON UPDATE no action;