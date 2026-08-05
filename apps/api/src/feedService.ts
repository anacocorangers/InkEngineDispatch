import {
  SOURCE_DEFINITIONS,
  type DispatchItem,
  type SourceResponse,
  type SourceStatus,
  type FeedResponse,
} from '@inkengine/contracts'
import { discordAdapter } from './adapters/discord.js'
import { communityEventsAdapter } from './adapters/communityEvents.js'
import { officialSiteAdapter } from './adapters/officialSite.js'
import { redditAdapter } from './adapters/reddit.js'
import { steamAdapter } from './adapters/steam.js'
import { tiktokAdapter } from './adapters/tiktok.js'
import { twitchAdapter } from './adapters/twitch.js'
import { youtubeAdapter } from './adapters/youtube.js'
import {
  facebookAdapter,
  instagramAdapter,
  linkedinAdapter,
  pinterestAdapter,
  snapchatAdapter,
  telegramAdapter,
  threadsAdapter,
  tumblrAdapter,
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
  communityEventsAdapter,
  discordAdapter,
  tiktokAdapter,
  xAdapter,
  facebookAdapter,
  instagramAdapter,
  threadsAdapter,
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
  adapters?: SourceAdapter[]
  healthRegistry?: Map<string, RuntimeSourceHealth>
}

export type RuntimeSourceHealth = {
  lastAttemptAt: string | null
  lastSuccessfulSync: string | null
  itemCount: number
  consecutiveFailures: number
  nextRetryAt: string | null
  errorMessage: string | null
}

const sourceHealth = new Map<string, RuntimeSourceHealth>()
const RETRY_BASE_MS = 60_000
const RETRY_MAX_MS = 30 * 60_000
const authoritativeLiveSourceIds = new Set(['youtube', 'twitch', 'media'])

function getHealth(registry: Map<string, RuntimeSourceHealth>, sourceId: string) {
  const current = registry.get(sourceId)
  if (current) return current
  const initial: RuntimeSourceHealth = {
    lastAttemptAt: null,
    lastSuccessfulSync: null,
    itemCount: 0,
    consecutiveFailures: 0,
    nextRetryAt: null,
    errorMessage: null,
  }
  registry.set(sourceId, initial)
  return initial
}

async function refreshSources(
  now: Date,
  repository: PostRepository,
  adapters: SourceAdapter[],
  registry: Map<string, RuntimeSourceHealth>,
) {
  const nowIso = now.toISOString()
  const eligibleAdapters = adapters.filter((adapter) => {
    const nextRetryAt = getHealth(registry, adapter.id).nextRetryAt
    return !nextRetryAt || Date.parse(nextRetryAt) <= now.getTime()
  })
  const fetched = await Promise.allSettled(
    eligibleAdapters.map((adapter) => adapter.fetchLatest({ nowIso })),
  )
  const posts: DispatchItem[] = []
  const liveSnapshots = new Map<DispatchItem['sourceId'], string[]>()

  fetched.forEach((result, index) => {
    const adapter = eligibleAdapters[index]
    const previous = getHealth(registry, adapter.id)
    if (result.status === 'fulfilled') {
      const liveItems = result.value.filter((item) => !item.id.endsWith('-sample'))
      posts.push(...liveItems)
      if (authoritativeLiveSourceIds.has(adapter.id)) {
        liveSnapshots.set(
          adapter.id,
          liveItems.filter((item) => item.tags.includes('live')).map((item) => item.id),
        )
      }
      if (result.value.length > 0 && liveItems.length === 0) return
      if (liveItems.length === 0 && !previous.lastSuccessfulSync) return
      registry.set(adapter.id, {
        lastAttemptAt: nowIso,
        lastSuccessfulSync: nowIso,
        itemCount: liveItems.length,
        consecutiveFailures: 0,
        nextRetryAt: null,
        errorMessage: null,
      })
      return
    }

    const consecutiveFailures = previous.consecutiveFailures + 1
    const retryDelay = Math.min(RETRY_BASE_MS * 2 ** (consecutiveFailures - 1), RETRY_MAX_MS)
    registry.set(adapter.id, {
      ...previous,
      lastAttemptAt: nowIso,
      consecutiveFailures,
      nextRetryAt: new Date(now.getTime() + retryDelay).toISOString(),
      errorMessage: result.reason instanceof Error ? result.reason.message : 'Source refresh failed.',
    })
  })

  await repository.upsertPosts(posts)
  await Promise.all(
    [...liveSnapshots].map(([sourceId, activeIds]) => repository.removeStaleLivePosts(sourceId, activeIds)),
  )
}

export async function buildFeed(
  now = new Date(),
  repository: PostRepository = fallbackRepository,
  options: FeedOptions = {},
): Promise<FeedResponse> {
  const nowIso = now.toISOString()
  if (!options.cursor) {
    await refreshSources(
      now,
      repository,
      options.adapters ?? sourceAdapters,
      options.healthRegistry ?? sourceHealth,
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

export async function buildSourceStatuses(
  now = new Date(),
  registry: Map<string, RuntimeSourceHealth> = sourceHealth,
): Promise<SourceResponse> {
  const nowIso = now.toISOString()
  const statuses: SourceStatus[] = SOURCE_DEFINITIONS.map((source) => {
    const health = getHealth(registry, source.id)
    const runtimeFields = {
      lastSync: health.lastAttemptAt,
      lastSuccessfulSync: health.lastSuccessfulSync,
      itemCount: health.itemCount,
      consecutiveFailures: health.consecutiveFailures,
      nextRetryAt: health.nextRetryAt,
    }

    if (health.errorMessage) {
      return {
        sourceId: source.id,
        state: 'degraded',
        message: health.lastSuccessfulSync
          ? `${health.errorMessage} Serving last-known-good reports.`
          : health.errorMessage,
        ...runtimeFields,
      }
    }

    if (health.lastSuccessfulSync) {
      return {
        sourceId: source.id,
        state: 'ok',
        message: health.itemCount
          ? `Imported ${health.itemCount} reports on the last refresh.`
          : 'Refresh succeeded with no new reports.',
        ...runtimeFields,
      }
    }

    if (source.id === 'media' && process.env.INKENGINE_MEDIA_FEED_URL) {
      return {
        sourceId: source.id,
        state: 'degraded',
        message: 'Hosted media is configured and awaiting its first refresh.',
        ...runtimeFields,
      }
    }

    if (source.id === 'youtube' && process.env.YOUTUBE_API_KEY) {
      return {
        sourceId: source.id,
        state: 'degraded',
        message: 'YouTube is configured and awaiting its first refresh.',
        ...runtimeFields,
      }
    }

    if (source.id === 'media') {
      return {
        sourceId: source.id,
        state: 'auth-required',
        message: 'Configure INKENGINE_MEDIA_FEED_URL to enable hosted playback.',
        ...runtimeFields,
      }
    }

    if (source.id === 'community-events' && !process.env.COMMUNITY_EVENT_FEED_URLS) {
      return {
        sourceId: source.id,
        state: 'auth-required',
        message: 'Select regiment calendar URLs with COMMUNITY_EVENT_FEED_URLS.',
        ...runtimeFields,
      }
    }

    if (source.id === 'twitch' && (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET)) {
      return {
        sourceId: source.id,
        state: 'auth-required',
        message: 'Configure TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET to find live streams.',
        ...runtimeFields,
      }
    }

    if (
      (source.id === 'community-events' && process.env.COMMUNITY_EVENT_FEED_URLS)
      || (source.id === 'twitch' && process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET)
    ) {
      return {
        sourceId: source.id,
        state: 'degraded',
        message: 'Source is configured and awaiting its first matching report.',
        ...runtimeFields,
      }
    }

    if (source.authRequirement === 'required') {
      return {
        sourceId: source.id,
        state: 'auth-required',
        message: 'Configure credentials to enable live pulls.',
        ...runtimeFields,
      }
    }

    if (source.authRequirement === 'optional') {
      return {
        sourceId: source.id,
        state: 'degraded',
        message: source.id === 'reddit'
          ? 'Reddit is using public RSS while API approval is pending.'
          : 'Awaiting a live source connection.',
        ...runtimeFields,
      }
    }

    return {
      sourceId: source.id,
      state: 'ok',
      message: 'Public source is awaiting its first refresh.',
      ...runtimeFields,
    }
  })

  return {
    generatedAt: nowIso,
    sources: statuses,
  }
}
