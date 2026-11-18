ALTER TABLE "conversation" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "parent_entry_id" integer;--> statement-breakpoint
CREATE INDEX "conversation_parentId_parentEntryId_idx" ON "conversation" USING btree ("parent_id","parent_entry_id");--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_parent_check" CHECK ("conversation"."parent_entry_id" is null or "conversation"."parent_id" is not null);