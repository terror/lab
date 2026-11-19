CREATE TABLE "tool_use" (
	"owner_id" text NOT NULL,
	"tool" text NOT NULL,
	CONSTRAINT "tool_use_owner_id_tool_pk" PRIMARY KEY("owner_id","tool")
);
--> statement-breakpoint
ALTER TABLE "tool_use" ADD CONSTRAINT "tool_use_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;