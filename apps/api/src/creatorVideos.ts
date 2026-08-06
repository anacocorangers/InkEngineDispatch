import type { DispatchItem } from '@inkengine/contracts'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const CACHE_TTL_MS = 3 * 60 * 60 * 1000

type ChannelVideosOptions = {
  apiKey?: string
  apiBase?: string
  fetchImpl?: typeof fetch
  now?: () => number
}

type ChannelCacheEntry = {
  uploadsPlaylistId: string | null
  videos: DispatchItem[]
  fetchedAt: number
}

type YouTubeChannelsResponse = {
  items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>
}

type YouTubePlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      title?: string
      description?: string
      publishedAt?: string
      resourceId?: { videoId?: string }
      thumbnails?: { high?: { url?: string }, medium?: { url?: string }, default?: { url?: string } }
    }
  }>
}

const channelCache = new Map<string, ChannelCacheEntry>()

export function extractYouTubeHandle(url: string): string | null {
  return url.match(/youtube(?:-nocookie)?\.com\/@([\w.-]+)/i)?.[1] ?? null
}

async function resolveUploadsPlaylistId(
  handle: string,
  apiKey: string,
  apiBase: string,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  const url = new URL(`${apiBase}/channels`)
  url.search = new URLSearchParams({ part: 'contentDetails', forHandle: `@${handle}`, key: apiKey }).toString()
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`YouTube channel lookup failed with status ${response.status}`)
  const payload = await response.json() as YouTubeChannelsResponse
  return payload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
}

export function parsePlaylistVideos(payload: YouTubePlaylistItemsResponse): DispatchItem[] {
  return (payload.items ?? []).flatMap((item): DispatchItem[] => {
    const snippet = item.snippet
    const videoId = snippet?.resourceId?.videoId
    if (!videoId || !snippet?.title || !snippet.publishedAt) return []

    const thumbnailUrl = snippet.thumbnails?.high?.url
      ?? snippet.thumbnails?.medium?.url
      ?? snippet.thumbnails?.default?.url

    return [{
      id: videoId,
      sourceId: 'youtube',
      title: snippet.title,
      summary: snippet.description?.trim() || 'Watch this video on YouTube.',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      publishedAt: new Date(snippet.publishedAt).toISOString(),
      tags: ['video', 'creator', 'war-of-rights'],
    }]
  })
}

async function fetchPlaylistVideos(
  playlistId: string,
  apiKey: string,
  apiBase: string,
  fetchImpl: typeof fetch,
): Promise<DispatchItem[]> {
  const url = new URL(`${apiBase}/playlistItems`)
  url.search = new URLSearchParams({ part: 'snippet', playlistId, maxResults: '6', key: apiKey }).toString()
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`YouTube playlist request failed with status ${response.status}`)
  return parsePlaylistVideos(await response.json() as YouTubePlaylistItemsResponse)
}

// Resolves a creator's YouTube channel handle to its uploads and returns their most recent videos.
// Requires YOUTUBE_API_KEY; returns an empty list (creator still shown, just without videos) when unavailable.
export async function getChannelVideos(channelUrl: string, options: ChannelVideosOptions = {}): Promise<DispatchItem[]> {
  const handle = extractYouTubeHandle(channelUrl)
  const apiKey = options.apiKey ?? process.env.YOUTUBE_API_KEY
  if (!handle || !apiKey) return []

  const apiBase = options.apiBase ?? YOUTUBE_API_BASE
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now?.() ?? Date.now()
  const cacheKey = handle.toLowerCase()
  const cached = channelCache.get(cacheKey)
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.videos

  try {
    const uploadsPlaylistId = cached?.uploadsPlaylistId ?? await resolveUploadsPlaylistId(handle, apiKey, apiBase, fetchImpl)
    if (!uploadsPlaylistId) {
      channelCache.set(cacheKey, { uploadsPlaylistId: null, videos: [], fetchedAt: now })
      return []
    }

    const videos = await fetchPlaylistVideos(uploadsPlaylistId, apiKey, apiBase, fetchImpl)
    channelCache.set(cacheKey, { uploadsPlaylistId, videos, fetchedAt: now })
    return videos
  }
  catch {
    return cached?.videos ?? []
  }
}

export { YOUTUBE_API_BASE }
