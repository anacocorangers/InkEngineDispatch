import type { DispatchItem } from '@inkengine/contracts'
import { and, desc, eq, lt, or, sql } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type FeedPage = {
  items: DispatchItem[]
  nextCursor: string | null
}

export interface PostRepository {
  readonly storage: 'memory' | 'postgres'
  upsertPosts(items: DispatchItem[]): Promise<void>
  listPosts(limit: number, cursor?: string): Promise<FeedPage>
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

  async upsertPosts(items: DispatchItem[]) {
    for (const item of items) {
      this.posts.set(`${item.sourceId}:${item.id}`, item)
    }
  }

  async listPosts(limit: number, cursor?: string): Promise<FeedPage> {
    const decoded = cursor ? decodeCursor(cursor) : null
    const sorted = [...this.posts.values()].sort(compareItems)
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
      items: selected.map((row) => {
        const youtubeMedia = row.sourceId === 'youtube' && row.externalId !== 'youtube-sample'
          ? {
              thumbnailUrl: `https://i.ytimg.com/vi/${row.externalId}/hqdefault.jpg`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${row.externalId}`,
            }
          : {}

        return {
          id: row.externalId,
          sourceId: row.sourceId as DispatchItem['sourceId'],
          title: row.title,
          summary: row.summary,
          url: row.url,
          ...youtubeMedia,
          publishedAt: row.publishedAt.toISOString(),
          tags: row.tags,
        }
      }),
      nextCursor: hasMore && last
        ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last.id })
        : null,
    }
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