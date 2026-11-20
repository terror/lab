DROP TABLE "tool_use" CASCADE;
--> statement-breakpoint
DELETE FROM "backfill_checkpoint" WHERE "pipeline" = 'tools';
