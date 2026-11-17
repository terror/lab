ALTER TABLE "connector" ADD COLUMN "owner_id" text;--> statement-breakpoint
UPDATE "connector" SET "owner_id" = (SELECT "id" FROM "user" ORDER BY "created_at" LIMIT 1);--> statement-breakpoint
DELETE FROM "connector" WHERE "owner_id" IS NULL;--> statement-breakpoint
ALTER TABLE "connector" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "connector" ADD CONSTRAINT "connector_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connector_ownerId_idx" ON "connector" USING btree ("owner_id");
