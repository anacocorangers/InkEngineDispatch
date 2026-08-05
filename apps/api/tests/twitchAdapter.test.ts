import { describe, expect, it, vi } from 'vitest'
import { createTwitchAdapter, parseTwitchChannels, TWITCH_SEARCH_URL } from '../src/adapters/twitch.js'

describe('twitch adapter', () => {
  it('maps live War of Rights channels', () => {
    expect(parseTwitchChannels([{
      id: '42',
      broadcaster_login: 'fieldreporter',
      display_name: 'FieldReporter',
      game_name: 'War of Rights',
      is_live: true,
      thumbnail_url: 'https://static-cdn.jtvnw.net/previews/live_user_name-{width}x{height}.jpg',
      title: 'Antietam campaign night',
      started_at: '2026-08-03T20:00:00Z',
    }])).toEqual([expect.objectContaining({
      id: '42:2026-08-03T20:00:00Z',
      sourceId: 'twitch',
      url: 'https://www.twitch.tv/fieldreporter',
      thumbnailUrl: 'https://static-cdn.jtvnw.net/previews/live_user_name-640x360.jpg',
      publishedAt: '2026-08-03T20:00:00.000Z',
    })])
  })

  it('authenticates and searches live channels', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
    const adapter = createTwitchAdapter({ clientId: 'client', clientSecret: 'secret', fetchImpl })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchImpl.mock.calls[0][0].toString()).toContain('grant_type=client_credentials')
    expect(fetchImpl).toHaveBeenNthCalledWith(2, TWITCH_SEARCH_URL, expect.objectContaining({
      headers: { authorization: 'Bearer token', 'client-id': 'client' },
    }))
  })

  it('does not call Twitch without credentials', async () => {
    const fetchImpl = vi.fn()
    const adapter = createTwitchAdapter({ fetchImpl })
    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})