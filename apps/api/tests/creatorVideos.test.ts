import { describe, expect, it, vi } from 'vitest'
import { extractYouTubeHandle, getChannelVideos, parsePlaylistVideos, YOUTUBE_API_BASE } from '../src/creatorVideos.js'

const playlistResponse = {
  items: [{
    snippet: {
      title: 'Cavalry Charge Highlights',
      description: 'A montage of recent skirmishes.',
      publishedAt: '2026-08-05T18:00:00Z',
      resourceId: { videoId: 'abc123xyz90' },
      thumbnails: { high: { url: 'https://i.ytimg.com/vi/abc123xyz90/hqdefault.jpg' } },
    },
  }],
}

describe('creator videos', () => {
  it('extracts a handle from a channel URL', () => {
    expect(extractYouTubeHandle('https://www.youtube.com/@BattleLineNetwork')).toBe('BattleLineNetwork')
    expect(extractYouTubeHandle('https://www.twitch.tv/example')).toBeNull()
  })

  it('maps playlist items to dispatch items', () => {
    expect(parsePlaylistVideos(playlistResponse)).toEqual([{
      id: 'abc123xyz90',
      sourceId: 'youtube',
      title: 'Cavalry Charge Highlights',
      summary: 'A montage of recent skirmishes.',
      url: 'https://www.youtube.com/watch?v=abc123xyz90',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc123xyz90/hqdefault.jpg',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc123xyz90',
      publishedAt: '2026-08-05T18:00:00.000Z',
      tags: ['video', 'creator', 'war-of-rights'],
    }])
  })

  it('stays idle without an API key', async () => {
    const fetchImpl = vi.fn()
    const videos = await getChannelVideos('https://www.youtube.com/@BattleLineNetwork', { apiKey: '', fetchImpl })
    expect(videos).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stays idle for non-YouTube channel URLs', async () => {
    const fetchImpl = vi.fn()
    const videos = await getChannelVideos('https://www.twitch.tv/example', { apiKey: 'key', fetchImpl })
    expect(videos).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('resolves the uploads playlist then fetches its videos', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUabc123' } } }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify(playlistResponse)))

    const videos = await getChannelVideos('https://www.youtube.com/@BattleLineNetwork', {
      apiKey: 'test-key',
      fetchImpl,
      now: () => 1_785_800_000_000,
    })

    expect(videos).toHaveLength(1)
    expect(videos[0].title).toBe('Cavalry Charge Highlights')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`${YOUTUBE_API_BASE}/channels`)
    expect(String(fetchImpl.mock.calls[1][0])).toContain(`${YOUTUBE_API_BASE}/playlistItems`)
  })

  it('caches results and skips refetching within the TTL', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ contentDetails: { relatedPlaylists: { uploads: 'UUabc123' } } }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify(playlistResponse)))

    const options = { apiKey: 'test-key', fetchImpl, now: () => 1_785_800_000_000 }
    await getChannelVideos('https://www.youtube.com/@CacheHandle', options)
    await getChannelVideos('https://www.youtube.com/@CacheHandle', options)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('falls back to an empty list when the channel lookup fails and nothing is cached', async () => {
    const videos = await getChannelVideos('https://www.youtube.com/@BrandNewHandle', {
      apiKey: 'test-key',
      fetchImpl: vi.fn(async () => new Response('', { status: 500 })),
      now: () => 1_785_900_000_000,
    })

    expect(videos).toEqual([])
  })
})
