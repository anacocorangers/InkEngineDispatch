import { sourceIdSchema, type DispatchItem } from '@inkengine/contracts'
import { and, desc, eq, lt, notInArray, or, sql } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { isAllowedDispatchItem } from '../moderation.js'
import * as schema from './schema.js'

export type FeedPage = {
  items: DispatchItem[]
  nextCursor: string | null
}

export type StoredSourceHealth = {
  sourceId: string
  lastAttemptAt: string | null
  lastSuccessfulSync: string | null
  itemCount: number
  consecutiveFailures: number
  nextRetryAt: string | null
  errorMessage: string | null
}

export interface PostRepository {
  readonly storage: 'memory' | 'postgres'
  upsertPosts(items: DispatchItem[]): Promise<void>
  removeStaleLivePosts(sourceId: DispatchItem['sourceId'], activeIds: string[]): Promise<void>
  listPosts(limit: number, cursor?: string): Promise<FeedPage>
  listDiscordChannelIds(): Promise<string[]>
  saveDiscordGuildChannels(guildId: string, guildName: string, channelIds: string[]): Promise<void>
  listSourceHealth(): Promise<StoredSourceHealth[]>
  saveSourceHealth(health: StoredSourceHealth[]): Promise<void>
}

type CursorValue = {
  publishedAt: string
  id: string
}

function encodeCursor(value: CursorValue) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeCursor(cursor: string): CursorValue | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorValue
    if (!parsed.publishedAt || !parsed.id) return null
    return parsed
  }
  catch {
    return null
  }
}

function compareItems(left: DispatchItem, right: DispatchItem) {
  const timeOrder = right.publishedAt.localeCompare(left.publishedAt)
  if (timeOrder !== 0) return timeOrder
  return right.id.localeCompare(left.id)
}

export class MemoryPostRepository implements PostRepository {
  readonly storage = 'memory' as const
  private readonly posts = new Map<string, DispatchItem>()
  private readonly discordGuilds = new Map<string, { name: string; channelIds: string[] }>()
  private readonly sourceHealth = new Map<string, StoredSourceHealth>()

  async upsertPosts(items: DispatchItem[]) {
    for (const item of items) {
      this.posts.set(`${item.sourceId}:${item.id}`, item)
    }
  }

  async removeStaleLivePosts(sourceId: DispatchItem['sourceId'], activeIds: string[]) {
    const activeIdSet = new Set(activeIds)
    for (const [key, item] of this.posts) {
      if (item.sourceId === sourceId && item.tags.includes('live') && !activeIdSet.has(item.id)) {
        this.posts.delete(key)
      }
    }
  }

  async listPosts(limit: number, cursor?: string): Promise<FeedPage> {
    const decoded = cursor ? decodeCursor(cursor) : null
    const sorted = [...this.posts.values()]
      .filter((item) => sourceIdSchema.safeParse(item.sourceId).success && isAllowedDispatchItem(item))
      .sort(compareItems)
    const start = decoded
      ? sorted.findIndex((item) => item.publishedAt === decoded.publishedAt && item.id === decoded.id) + 1
      : 0
    const page = sorted.slice(Math.max(start, 0), Math.max(start, 0) + limit + 1)
    const hasMore = page.length > limit
    const items = page.slice(0, limit)
    const last = items.at(-1)

    return {
      items,
      nextCursor: hasMore && last
        ? encodeCursor({ publishedAt: last.publishedAt, id: last.id })
        : null,
    }
  }

  async listDiscordChannelIds() {
    return [...new Set([...this.discordGuilds.values()].flatMap((guild) => guild.channelIds))]
  }

  async saveDiscordGuildChannels(guildId: string, guildName: string, channelIds: string[]) {
    this.discordGuilds.set(guildId, { name: guildName, channelIds: [...new Set(channelIds)] })
  }

  async listSourceHealth() {
    return [...this.sourceHealth.values()].map((health) => ({ ...health }))
  }

  async saveSourceHealth(health: StoredSourceHealth[]) {
    health.forEach((entry) => this.sourceHealth.set(entry.sourceId, { ...entry }))
  }
}

export class PostgresPostRepository implements PostRepository {
  readonly storage = 'postgres' as const

  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async upsertPosts(items: DispatchItem[]) {
    if (items.length === 0) return

    await this.db.insert(schema.posts)
      .values(items.map((item) => ({
        sourceId: item.sourceId,
        externalId: item.id,
        title: item.title,
        summary: item.summary,
        url: item.url,
        publishedAt: new Date(item.publishedAt),
        tags: item.tags,
        rawPayload: item,
        updatedAt: new Date(),
      })))
      .onConflictDoUpdate({
        target: [schema.posts.sourceId, schema.posts.externalId],
        set: {
          title: sql`excluded.title`,
          summary: sql`excluded.summary`,
          url: sql`excluded.url`,
          publishedAt: sql`excluded.published_at`,
          tags: sql`excluded.tags`,
          rawPayload: sql`excluded.raw_payload`,
          updatedAt: new Date(),
        },
      })
  }

  async removeStaleLivePosts(sourceId: DispatchItem['sourceId'], activeIds: string[]) {
    const conditions = [
      eq(schema.posts.sourceId, sourceId),
      sql`${schema.posts.tags} @> '["live"]'::jsonb`,
    ]
    if (activeIds.length > 0) conditions.push(notInArray(schema.posts.externalId, activeIds))
    await this.db.delete(schema.posts).where(and(...conditions))
  }

  async listPosts(limit: number, cursor?: string): Promise<FeedPage> {
    const decoded = cursor ? decodeCursor(cursor) : null
    const cursorDate = decoded ? new Date(decoded.publishedAt) : null
    const rows = await this.db.select()
      .from(schema.posts)
      .where(decoded && cursorDate
        ? or(
            lt(schema.posts.publishedAt, cursorDate),
            and(eq(schema.posts.publishedAt, cursorDate), lt(schema.posts.id, decoded.id)),
          )
        : undefined)
      .orderBy(desc(schema.posts.publishedAt), desc(schema.posts.id))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const selected = rows.slice(0, limit)
    const last = selected.at(-1)

    return {
      items: selected.flatMap((row): DispatchItem[] => {
        const sourceId = sourceIdSchema.safeParse(row.sourceId)
        if (!sourceId.success) return []
        const rawPayload = row.rawPayload as Partial<DispatchItem> | null
        const storedMedia = {
          thumbnailUrl: rawPayload?.thumbnailUrl,
          playbackUrl: rawPayload?.playbackUrl,
          embedUrl: rawPayload?.embedUrl,
        }
        const youtubeMedia = row.sourceId === 'youtube' && row.externalId !== 'youtube-sample'
          ? {
              thumbnailUrl: `https://i.ytimg.com/vi/${row.externalId}/hqdefault.jpg`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${row.externalId}`,
            }
          : {}

        const item: DispatchItem = {
          id: row.externalId,
          sourceId: sourceId.data,
          title: row.title,
          summary: row.summary,
          url: row.url,
          ...storedMedia,
          ...youtubeMedia,
          publishedAt: row.publishedAt.toISOString(),
          tags: row.tags,
        }
        return isAllowedDispatchItem(item) ? [item] : []
      }),
      nextCursor: hasMore && last
        ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last.id })
        : null,
    }
  }

  async listDiscordChannelIds() {
    const rows = await this.db.select({ channelIds: schema.discordGuildSettings.channelIds })
      .from(schema.discordGuildSettings)
    return [...new Set(rows.flatMap((row) => row.channelIds))]
  }

  async saveDiscordGuildChannels(guildId: string, guildName: string, channelIds: string[]) {
    await this.db.insert(schema.discordGuildSettings)
      .values({ guildId, guildName, channelIds: [...new Set(channelIds)] })
      .onConflictDoUpdate({
        target: schema.discordGuildSettings.guildId,
        set: { guildName, channelIds: [...new Set(channelIds)], updatedAt: new Date() },
      })
  }

  async listSourceHealth(): Promise<StoredSourceHealth[]> {
    const rows = await this.db.select().from(schema.sourceHealth)
    return rows.map((row) => ({
      sourceId: row.sourceId,
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      lastSuccessfulSync: row.lastSuccessfulSync?.toISOString() ?? null,
      itemCount: row.itemCount,
      consecutiveFailures: row.consecutiveFailures,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
      errorMessage: row.errorMessage,
    }))
  }

  async saveSourceHealth(health: StoredSourceHealth[]) {
    if (health.length === 0) return
    await this.db.insert(schema.sourceHealth)
      .values(health.map((entry) => ({
        sourceId: entry.sourceId,
        lastAttemptAt: entry.lastAttemptAt ? new Date(entry.lastAttemptAt) : null,
        lastSuccessfulSync: entry.lastSuccessfulSync ? new Date(entry.lastSuccessfulSync) : null,
        itemCount: entry.itemCount,
        consecutiveFailures: entry.consecutiveFailures,
        nextRetryAt: entry.nextRetryAt ? new Date(entry.nextRetryAt) : null,
        errorMessage: entry.errorMessage,
      })))
      .onConflictDoUpdate({
        target: schema.sourceHealth.sourceId,
        set: {
          lastAttemptAt: sql`excluded.last_attempt_at`,
          lastSuccessfulSync: sql`excluded.last_successful_sync`,
          itemCount: sql`excluded.item_count`,
          consecutiveFailures: sql`excluded.consecutive_failures`,
          nextRetryAt: sql`excluded.next_retry_at`,
          errorMessage: sql`excluded.error_message`,
          updatedAt: new Date(),
        },
      })
  }
}

export function getPostgresOptions(databaseUrl: string) {
  const host = new URL(databaseUrl).searchParams.get('host')

  return {
    max: 10,
    prepare: false,
    ...(host ? { host } : {}),
  }
}

export function getPostgresUrl(databaseUrl: string) {
  const url = new URL(databaseUrl)
  url.searchParams.delete('host')
  return url.toString()
}

export function createPostRepository(databaseUrl?: string): PostRepository {
  if (!databaseUrl) return new MemoryPostRepository()
  const client = postgres(getPostgresUrl(databaseUrl), getPostgresOptions(databaseUrl))
  const db = drizzle(client, { schema })
  return new PostgresPostRepository(db)
}