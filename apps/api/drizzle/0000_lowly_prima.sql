CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar(40) NOT NULL,
	"status" varchar(20) NOT NULL,
	"items_found" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" varchar(40) NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"url" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_payload" jsonb,
	"relevance_score" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_cursors" (
	"source_id" varchar(40) PRIMARY KEY NOT NULL,
	"cursor" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collection_runs_source_started_idx" ON "collection_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_source_external_unique" ON "posts" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "posts_published_id_idx" ON "posts" USING btree ("published_at","id");--> statement-breakpoint
CREATE INDEX "posts_source_published_idx" ON "posts" USING btree ("source_id","published_at");--> statement-breakpoint
CREATE INDEX "posts_relevance_idx" ON "posts" USING btree ("relevance_score");