CREATE TABLE IF NOT EXISTS "source_health" (
	"source_id" varchar(40) PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_successful_sync" timestamp with time zone,
	"item_count" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"error_message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
