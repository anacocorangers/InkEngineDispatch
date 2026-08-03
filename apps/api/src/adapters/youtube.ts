import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

type YouTubeSearchItem = {
  id?: { videoId?: string }
  snippet?: {
    title?: string
    description?: string
    publishedAt?: string
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
  let lastFetchedAt = 0

  return {
    id: 'youtube',
    async fetchLatest(context) {
      const apiKey = options.apiKey ?? process.env.YOUTUBE_API_KEY
      if (!apiKey) return [sampleItem(context.nowIso)]

      const now = Date.parse(context.nowIso)
      const refreshIntervalMs = options.refreshIntervalMs ?? 30 * 60 * 1000
      if (lastFetchedAt && now - lastFetchedAt < refreshIntervalMs) return []

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

      const response = await (options.fetchImpl ?? fetch)(url)
      if (!response.ok) {
        throw new Error(`YouTube search failed with status ${response.status}`)
      }

      const payload = await response.json() as YouTubeSearchResponse
      lastFetchedAt = now
      return (payload.items ?? []).flatMap((item): DispatchItem[] => {
        const videoId = item.id?.videoId
        const snippet = item.snippet
        if (!videoId || !snippet?.title || !snippet.publishedAt) return []

        const thumbnailUrl = snippet.thumbnails?.high?.url
          ?? snippet.thumbnails?.medium?.url
          ?? snippet.thumbnails?.default?.url

        return [{
          id: videoId,
          sourceId: 'youtube',
          title: snippet.title,
          summary: snippet.description?.trim() || 'Watch this War of Rights video on YouTube.',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
          publishedAt: new Date(snippet.publishedAt).toISOString(),
          tags: ['video', 'war-of-rights'],
        }]
      })
    },
  }
}

export const youtubeAdapter = createYouTubeAdapter()
