CREATE TABLE "connector" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "connector_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
