import {
  SOURCE_DEFINITIONS,
  type SourceResponse,
  type SourceStatus,
  type FeedResponse,
} from '@inkengine/contracts'
import { discordAdapter } from './adapters/discord.js'
import { officialSiteAdapter } from './adapters/officialSite.js'
import { redditAdapter } from './adapters/reddit.js'
import { steamAdapter } from './adapters/steam.js'
import { tiktokAdapter } from './adapters/tiktok.js'
import { youtubeAdapter } from './adapters/youtube.js'
import {
  blueskyAdapter,
  facebookAdapter,
  instagramAdapter,
  linkedinAdapter,
  mastodonAdapter,
  pinterestAdapter,
  snapchatAdapter,
  telegramAdapter,
  threadsAdapter,
  tumblrAdapter,
  twitchAdapter,
  xAdapter,
} from './adapters/social.js'
import { mediaAdapter } from './adapters/media.js'
import type { SourceAdapter } from './adapters/types.js'
import { MemoryPostRepository, type PostRepository } from './db/repository.js'

export const sourceAdapters: SourceAdapter[] = [
  youtubeAdapter,
  mediaAdapter,
  twitchAdapter,
  steamAdapter,
  redditAdapter,
  officialSiteAdapter,
  discordAdapter,
  tiktokAdapter,
  xAdapter,
  facebookAdapter,
  instagramAdapter,
  threadsAdapter,
  blueskyAdapter,
  mastodonAdapter,
  linkedinAdapter,
  telegramAdapter,
  pinterestAdapter,
  snapchatAdapter,
  tumblrAdapter,
]

const fallbackRepository = new MemoryPostRepository()

export type FeedOptions = {
  cursor?: string
  limit?: number
}

export async function buildFeed(
  now = new Date(),
  repository: PostRepository = fallbackRepository,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  const nowIso = now.toISOString()
  if (!options.cursor) {
    const fetched = await Promise.allSettled(
      sourceAdapters.map((adapter) => adapter.fetchLatest({ nowIso })),
    )
    await repository.upsertPosts(
      fetched.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
    )
  }

  const page = await repository.listPosts(options.limit ?? 20, options.cursor)

  return {
    generatedAt: nowIso,
    items: page.items,
    nextCursor: page.nextCursor,
    storage: repository.storage,
  }
}

export async function buildSourceStatuses(now = new Date()): Promise<SourceResponse> {
  const nowIso = now.toISOString()
  const statuses: SourceStatus[] = SOURCE_DEFINITIONS.map((source) => {
    if (source.id === 'media' && process.env.INKENGINE_MEDIA_FEED_URL) {
      return {
        sourceId: source.id,
        state: 'ok',
        message: 'Hosted media feed is connected.',
        lastSync: nowIso,
      }
    }

    if (source.id === 'youtube' && process.env.YOUTUBE_API_KEY) {
      return {
        sourceId: source.id,
        state: 'ok',
        message: 'YouTube Data API search is connected.',
        lastSync: nowIso,
      }
    }

    if (source.id === 'media') {
      return {
        sourceId: source.id,
        state: 'auth-required',
        message: 'Configure INKENGINE_MEDIA_FEED_URL to enable hosted playback.',
        lastSync: nowIso,
      }
    }

    if (source.authRequirement === 'required') {
      return {
        sourceId: source.id,
        state: 'auth-required',
        message: 'Configure credentials to enable live pulls.',
        lastSync: nowIso,
      }
    }

    if (source.authRequirement === 'optional') {
      return {
        sourceId: source.id,
        state: 'degraded',
        message: 'Running with sample adapter payloads.',
        lastSync: nowIso,
      }
    }

    return {
      sourceId: source.id,
      state: 'ok',
      message: 'Public endpoint path ready.',
      lastSync: nowIso,
    }
  })

  return {
    generatedAt: nowIso,
    sources: statuses,
  }
}
