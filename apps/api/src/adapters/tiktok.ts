import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

type TikTokVideo = {
  id?: string
  title?: string
  video_description?: string
  cover_image_url?: string
  share_url?: string
  create_time?: number
}

type TikTokVideoListResponse = {
  data?: { videos?: TikTokVideo[] }
  error?: { code?: string; message?: string }
}

type TikTokAdapterOptions = {
  accessToken?: string
  fetchImpl?: typeof fetch
}

const TIKTOK_VIDEO_FIELDS = [
  'id',
  'title',
  'video_description',
  'cover_image_url',
  'share_url',
  'create_time',
].join(',')

export function createTikTokAdapter(options: TikTokAdapterOptions = {}): SourceAdapter {
  return {
    id: 'tiktok',
    async fetchLatest() {
      const accessToken = options.accessToken ?? process.env.TIKTOK_ACCESS_TOKEN
      if (!accessToken) return []

      const url = new URL('https://open.tiktokapis.com/v2/video/list/')
      url.searchParams.set('fields', TIKTOK_VIDEO_FIELDS)
      const fetchImpl = options.fetchImpl ?? fetch
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ max_count: 20 }),
      })
      if (!response.ok) {
        throw new Error(`TikTok video list request failed with status ${response.status}`)
      }

      const payload = await response.json() as TikTokVideoListResponse
      if (payload.error?.code && payload.error.code !== 'ok') {
        throw new Error(`TikTok video list failed: ${payload.error.message ?? payload.error.code}`)
      }

      return (payload.data?.videos ?? []).flatMap((video): DispatchItem[] => {
        if (!video.id || !video.share_url || !video.create_time) return []
        const description = video.video_description?.trim()
        const title = video.title?.trim() || description?.split(/\r?\n/, 1)[0] || 'TikTok video'

        return [{
          id: `tiktok:${video.id}`,
          sourceId: 'tiktok',
          title: title.slice(0, 120),
          summary: description || title,
          url: video.share_url,
          thumbnailUrl: video.cover_image_url,
          publishedAt: new Date(video.create_time * 1000).toISOString(),
          tags: ['tiktok', 'video', 'war-of-rights'],
        }]
      })
    },
  }
}

export const tiktokAdapter = createTikTokAdapter()
