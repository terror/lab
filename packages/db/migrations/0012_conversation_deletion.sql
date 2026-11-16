CREATE TABLE "conversation_deletion" (
	"id" integer PRIMARY KEY NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
