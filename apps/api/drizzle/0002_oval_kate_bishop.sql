CREATE TABLE IF NOT EXISTS "discord_guild_settings" (
	"guild_id" varchar(32) PRIMARY KEY NOT NULL,
	"guild_name" text NOT NULL,
	"channel_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"configured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
