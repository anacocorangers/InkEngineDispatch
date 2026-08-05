import { describe, expect, it, vi } from 'vitest'
import { createTikTokAdapter } from '../src/adapters/tiktok.js'

describe('tiktok adapter', () => {
  it('stays disabled without an approved user access token', async () => {
    const fetchMock = vi.fn()
    const adapter = createTikTokAdapter({ fetchImpl: fetchMock })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-04T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads authorized videos through the official TikTok Display API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: {
        videos: [{
          id: 'video-1',
          title: 'War of Rights field report',
          video_description: 'A field report from the latest event.',
          cover_image_url: 'https://p16-sign.tiktokcdn-us.com/cover.jpeg',
          share_url: 'https://www.tiktok.com/@inkengine/video/video-1',
          create_time: 1785801600,
        }],
      },
      error: { code: 'ok', message: '' },
    }), { status: 200 }))
    const adapter = createTikTokAdapter({ accessToken: 'test-token', fetchImpl: fetchMock })

    const items = await adapter.fetchLatest({ nowIso: '2026-08-04T00:00:00.000Z' })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'https://open.tiktokapis.com', pathname: '/v2/video/list/' }),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer test-token' }),
        body: JSON.stringify({ max_count: 20 }),
      }),
    )
    expect(items).toEqual([expect.objectContaining({
      id: 'tiktok:video-1',
      sourceId: 'tiktok',
      title: 'War of Rights field report',
      url: 'https://www.tiktok.com/@inkengine/video/video-1',
      publishedAt: '2026-08-04T00:00:00.000Z',
    })])
  })
})