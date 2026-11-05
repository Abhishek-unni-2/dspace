CREATE TABLE "activity_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"collection" text NOT NULL,
	"record_id" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_counters" (
	"name" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_records" (
	"collection" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	CONSTRAINT "erp_records_collection_id_pk" PRIMARY KEY("collection","id")
);
