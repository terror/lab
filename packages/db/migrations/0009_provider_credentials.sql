CREATE TABLE "provider_credential" (
	"provider_id" text PRIMARY KEY NOT NULL,
	"credential" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
