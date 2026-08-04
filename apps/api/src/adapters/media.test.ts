import { describe, expect, it } from 'vitest'
import { createMediaAdapter } from './media.js'

describe('media adapter', () => {
  it('maps a curated media feed item to a dispatch item', async () => {
    const adapter = createMediaAdapter({
      feedUrl: 'https://example.com/media-feed.json',
      fetchImpl: async () => new Response(JSON.stringify({
        items: [
          {
            id: 'hosted-clip-1',
            title: 'Hosted clip',
            summary: 'A curated HLS clip.',
            url: 'https://example.com/story',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            playbackUrl: 'https://storage.googleapis.com/inkengine-dispatch-media/videos/hosted-clip-1/master.m3u8',
            publishedAt: '2026-08-03T00:00:00.000Z',
            tags: ['video'],
          },
        ],
      }), { status: 200 }),
    })

    const items = await adapter.fetchLatest({ nowIso: '2026-08-03T01:00:00.000Z' })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'hosted-clip-1',
      sourceId: 'media',
      playbackUrl: 'https://storage.googleapis.com/inkengine-dispatch-media/videos/hosted-clip-1/master.m3u8',
    })
  })
})