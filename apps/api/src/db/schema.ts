import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: varchar('source_id', { length: 40 }).notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  url: text('url').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  relevanceScore: integer('relevance_score').notNull().default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('posts_source_external_unique').on(table.sourceId, table.externalId),
  index('posts_published_id_idx').on(table.publishedAt, table.id),
  index('posts_source_published_idx').on(table.sourceId, table.publishedAt),
  index('posts_relevance_idx').on(table.relevanceScore),
  index('posts_search_idx').using(
    'gin',
    sql`to_tsvector('english', ${table.title} || ' ' || ${table.summary})`,
  ),
])

export const sourceCursors = pgTable('source_cursors', {
  sourceId: varchar('source_id', { length: 40 }).primaryKey(),
  cursor: text('cursor').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const collectionRuns = pgTable('collection_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: varchar('source_id', { length: 40 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  itemsFound: integer('items_found').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (table) => [
  index('collection_runs_source_started_idx').on(table.sourceId, table.startedAt),
])

export const discordGuildSettings = pgTable('discord_guild_settings', {
  guildId: varchar('guild_id', { length: 32 }).primaryKey(),
  guildName: text('guild_name').notNull(),
  channelIds: jsonb('channel_ids').$type<string[]>().notNull().default([]),
  configuredAt: timestamp('configured_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sourceHealth = pgTable('source_health', {
  sourceId: varchar('source_id', { length: 40 }).primaryKey(),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastSuccessfulSync: timestamp('last_successful_sync', { withTimezone: true }),
  itemCount: integer('item_count').notNull().default(0),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})