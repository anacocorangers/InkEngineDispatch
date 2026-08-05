import type { DispatchItem } from '@inkengine/contracts'
import { isAllowedDispatchItem } from '../moderation.js'
import type { SourceAdapter } from './types.js'

type YouTubeSearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
    liveBroadcastContent?: 'live' | 'none' | 'upcoming'
    thumbnails?: {
      high?: { url?: string }
      medium?: { url?: string }
      default?: { url?: string }
    }
  }
}

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[]
}

type YouTubeAdapterOptions = {
  apiKey?: string
  fetchImpl?: typeof fetch
  refreshIntervalMs?: number
  liveRefreshIntervalMs?: number
  recentRefreshIntervalMs?: number
}

function sampleItem(nowIso: string): DispatchItem {
  return {
    id: 'youtube-sample',
    sourceId: 'youtube',
    title: 'YouTube adapter stub ready',
    summary: 'Connect YouTube Data API key to replace sample payloads.',
    url: 'https://youtube.com/',
    publishedAt: nowIso,
    tags: ['video', 'stub'],
  }
}

export function createYouTubeAdapter(options: YouTubeAdapterOptions = {}): SourceAdapter {
  let lastLiveFetchedAt = 0
  let lastRecentFetchedAt = 0
  let cachedLiveItems: DispatchItem[] = []
  let cachedRecentItems: DispatchItem[] = []

  return {
    id: 'youtube',
    async fetchLatest(context) {
      const apiKey = options.apiKey ?? process.env.YOUTUBE_API_KEY
      if (!apiKey) return [sampleItem(context.nowIso)]

      const now = Date.parse(context.nowIso)
      const liveRefreshIntervalMs = options.refreshIntervalMs
        ?? options.liveRefreshIntervalMs
        ?? 30 * 60 * 1000
      const recentRefreshIntervalMs = options.refreshIntervalMs
        ?? options.recentRefreshIntervalMs
        ?? 6 * 60 * 60 * 1000
      const searches: Array<{ kind: 'live' | 'recent'; url: URL }> = []

      if (!lastLiveFetchedAt || now - lastLiveFetchedAt >= liveRefreshIntervalMs) {
        const url = new URL('https://www.googleapis.com/youtube/v3/search')
        url.search = new URLSearchParams({
          part: 'snippet',
          q: '"War of Rights"',
          type: 'video',
          eventType: 'live',
          videoEmbeddable: 'true',
          maxResults: '25',
          key: apiKey,
        }).toString()
        searches.push({ kind: 'live', url })
      }

      if (!lastRecentFetchedAt || now - lastRecentFetchedAt >= recentRefreshIntervalMs) {
        const url = new URL('https://www.googleapis.com/youtube/v3/search')
        url.search = new URLSearchParams({
          part: 'snippet',
          q: '"War of Rights"',
          type: 'video',
          videoEmbeddable: 'true',
          order: 'date',
          maxResults: '12',
          key: apiKey,
        }).toString()
        searches.push({ kind: 'recent', url })
      }

      const fetchImpl = options.fetchImpl ?? fetch
      const responses = await Promise.all(searches.map(async (search) => {
        const response = await fetchImpl(search.url)
        if (!response.ok) throw new Error(`YouTube ${search.kind} search failed with status ${response.status}`)
        return { kind: search.kind, payload: await response.json() as YouTubeSearchResponse }
      }))

      const mapItems = (payload: YouTubeSearchResponse, liveSearch: boolean) => (payload.items ?? []).flatMap((item): DispatchItem[] => {
        const videoId = item.id?.videoId
        const snippet = item.snippet
        if (!videoId || !snippet?.title || !snippet.publishedAt) return []

        const thumbnailUrl = snippet.thumbnails?.high?.url
          ?? snippet.thumbnails?.medium?.url
          ?? snippet.thumbnails?.default?.url

        const dispatchItem: DispatchItem = {
          id: videoId,
          sourceId: 'youtube',
          title: snippet.title,
          summary: snippet.description?.trim() || 'Watch this War of Rights video on YouTube.',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
          publishedAt: new Date(snippet.publishedAt).toISOString(),
          tags: [
            'video',
            'war-of-rights',
            ...(liveSearch || snippet.liveBroadcastContent === 'live' ? ['live'] : []),
          ],
        }

        return isAllowedDispatchItem(dispatchItem) ? [dispatchItem] : []
      })

      for (const response of responses) {
        if (response.kind === 'live') {
          cachedLiveItems = mapItems(response.payload, true)
          lastLiveFetchedAt = now
        }
        else {
          cachedRecentItems = mapItems(response.payload, false)
          lastRecentFetchedAt = now
        }
      }

      return [...new Map(
        [...cachedRecentItems, ...cachedLiveItems].map((item) => [item.id, item]),
      ).values()]
    },
  }
}

export const youtubeAdapter = createYouTubeAdapter()
