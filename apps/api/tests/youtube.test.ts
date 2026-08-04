import { describe, expect, it, vi } from 'vitest'
import { createYouTubeAdapter } from '../src/adapters/youtube.js'

describe('YouTube adapter', () => {
  it('maps embeddable search results into dispatch videos', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      items: [
        {
          id: { videoId: 'video-123' },
          snippet: {
            title: 'War of Rights Event',
            description: 'A community battle.',
            publishedAt: '2026-08-02T18:00:00Z',
            thumbnails: { high: { url: 'https://i.ytimg.com/vi/video-123/hqdefault.jpg' } },
          },
        },
        {
          id: { videoId: 'blocked-video' },
          snippet: {
            title: 'Free War of Rights cheat menu',
            description: 'Download this hack.',
            publishedAt: '2026-08-02T19:00:00Z',
          },
        },
      ],
    }), { status: 200 }))
    const adapter = createYouTubeAdapter({ apiKey: 'test-key', fetchImpl })

    const items = await adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('q=%22War+of+Rights%22')
    expect(items).toEqual([expect.objectContaining({
      id: 'video-123',
      sourceId: 'youtube',
      url: 'https://www.youtube.com/watch?v=video-123',
      embedUrl: 'https://www.youtube-nocookie.com/embed/video-123',
    })])

    const throttled = await adapter.fetchLatest({ nowIso: '2026-08-02T18:01:00.000Z' })
    expect(throttled).toEqual([])
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('keeps the development placeholder when no API key is configured', async () => {
    const adapter = createYouTubeAdapter({ apiKey: '' })
    const items = await adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })

    expect(items[0]?.id).toBe('youtube-sample')
  })
})