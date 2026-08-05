import { describe, expect, it, vi } from 'vitest'
import { createYouTubeAdapter } from '../src/adapters/youtube.js'

describe('YouTube adapter', () => {
  it('maps embeddable search results into dispatch videos', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const isLive = url.searchParams.get('eventType') === 'live'
      return new Response(JSON.stringify({
        items: isLive
          ? [{
              id: { videoId: 'live-video' },
              snippet: {
                title: 'War of Rights Live Event',
                description: 'A battle streaming now.',
                publishedAt: '2026-08-02T20:00:00Z',
                liveBroadcastContent: 'live',
                thumbnails: { high: { url: 'https://i.ytimg.com/vi/live-video/hqdefault.jpg' } },
              },
            }]
          : [{
              id: { videoId: 'video-123' },
              snippet: {
                title: 'War of Rights Event',
                description: 'A community battle.',
                publishedAt: '2026-08-02T18:00:00Z',
                thumbnails: { high: { url: 'https://i.ytimg.com/vi/video-123/hqdefault.jpg' } },
              },
            }, {
              id: { videoId: 'blocked-video' },
              snippet: {
                title: 'Free War of Rights cheat menu',
                description: 'Download this hack.',
                publishedAt: '2026-08-02T19:00:00Z',
              },
            }],
      }), { status: 200 })
    })
    const adapter = createYouTubeAdapter({ apiKey: 'test-key', fetchImpl })

    const items = await adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const requestedUrls = fetchImpl.mock.calls.map(([input]) => new URL(String(input)))
    expect(requestedUrls.every((url) => url.searchParams.get('q') === '"War of Rights"')).toBe(true)
    expect(requestedUrls.some((url) => url.searchParams.get('eventType') === 'live')).toBe(true)
    expect(items).toEqual([
      expect.objectContaining({
        id: 'video-123',
        sourceId: 'youtube',
        url: 'https://www.youtube.com/watch?v=video-123',
        embedUrl: 'https://www.youtube-nocookie.com/embed/video-123',
      }),
      expect.objectContaining({
        id: 'live-video',
        tags: expect.arrayContaining(['live']),
      }),
    ])

    const throttled = await adapter.fetchLatest({ nowIso: '2026-08-03T00:01:00.000Z' })
    expect(throttled).toEqual(items)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('keeps the development placeholder when no API key is configured', async () => {
    const adapter = createYouTubeAdapter({ apiKey: '' })
    const items = await adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })

    expect(items[0]?.id).toBe('youtube-sample')
  })
})