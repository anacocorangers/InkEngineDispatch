import type { DispatchItem } from '@inkengine/contracts'
import { isAllowedDispatchItem } from '../moderation.js'
import type { SourceAdapter } from './types.js'

type MediaFeedItem = {
  id?: string
  title?: string
  summary?: string
  url?: string
  thumbnailUrl?: string
  playbackUrl?: string
  publishedAt?: string
  tags?: string[]
}

type MediaFeedResponse = {
  items?: MediaFeedItem[]
}

type MediaAdapterOptions = {
  feedUrl?: string
  token?: string
  fetchImpl?: typeof fetch
}

function getItems(payload: MediaFeedResponse | MediaFeedItem[]) {
  return Array.isArray(payload) ? payload : payload.items ?? []
}

export function createMediaAdapter(options: MediaAdapterOptions = {}): SourceAdapter {
  return {
    id: 'media',
    async fetchLatest() {
      const feedUrl = options.feedUrl ?? process.env.INKENGINE_MEDIA_FEED_URL
      if (!feedUrl) return []

      const token = options.token ?? process.env.INKENGINE_MEDIA_FEED_TOKEN
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await (options.fetchImpl ?? fetch)(feedUrl, { headers })
      if (!response.ok) {
        throw new Error(`Media feed request failed with status ${response.status}`)
      }

      const payload = await response.json() as MediaFeedResponse | MediaFeedItem[]
      return getItems(payload).flatMap((item): DispatchItem[] => {
        if (!item.id || !item.title || !item.summary || !item.url || !item.playbackUrl || !item.publishedAt) {
          return []
        }

        const dispatchItem: DispatchItem = {
          id: item.id,
          sourceId: 'media',
          title: item.title,
          summary: item.summary,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          playbackUrl: item.playbackUrl,
          publishedAt: new Date(item.publishedAt).toISOString(),
          tags: item.tags ?? ['video', 'hosted'],
        }

        return isAllowedDispatchItem(dispatchItem) ? [dispatchItem] : []
      })
    },
  }
}

export const mediaAdapter = createMediaAdapter()