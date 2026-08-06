import { describe, expect, it, vi } from 'vitest'
import { createTelegramAdapter, parseTelegramUpdates, TELEGRAM_API_BASE } from '../src/adapters/telegram.js'

const publicUpdate = {
  update_id: 501,
  channel_post: {
    message_id: 42,
    date: 1_785_800_000,
    text: 'New patch notes are live for War of Rights.',
    chat: { id: -1001234567890, username: 'WarOfRightsHQ', title: 'War of Rights HQ' },
  },
}

const privateUpdate = {
  update_id: 502,
  channel_post: {
    message_id: 7,
    date: 1_785_800_100,
    photo: [{ file_id: 'abc' }],
    chat: { id: -1009876543210, title: 'Regiment Channel' },
  },
}

describe('telegram adapter', () => {
  it('maps allowed public channel posts to dispatch items', () => {
    expect(parseTelegramUpdates([publicUpdate], new Set(['warofrightshq']))).toEqual([{
      id: 'telegram:-1001234567890:42',
      sourceId: 'telegram',
      title: 'War of Rights HQ update',
      summary: 'New patch notes are live for War of Rights.',
      url: 'https://t.me/WarOfRightsHQ/42',
      publishedAt: '2026-08-03T23:33:20.000Z',
      tags: ['telegram', 'community', 'war-of-rights'],
    }])
  })

  it('builds a t.me/c link and tags media for private channels without a username', () => {
    expect(parseTelegramUpdates([privateUpdate], new Set(['-1009876543210']))).toEqual([expect.objectContaining({
      id: 'telegram:-1009876543210:7',
      url: 'https://t.me/c/9876543210/7',
      tags: ['telegram', 'community', 'media', 'war-of-rights'],
    })])
  })

  it('filters out posts from channels that are not explicitly allowed', () => {
    expect(parseTelegramUpdates([publicUpdate], new Set(['someotherchannel']))).toEqual([])
  })

  it('stays idle until a bot token and channel list are configured', async () => {
    const fetchImpl = vi.fn()
    const adapter = createTelegramAdapter({ botToken: '', channelIds: [], fetchImpl })
    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('polls getUpdates and advances the offset on the next call', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: [publicUpdate] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: [] })))
    const adapter = createTelegramAdapter({
      botToken: 'bot-token',
      channelIds: ['WarOfRightsHQ'],
      fetchImpl,
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toHaveLength(1)
    await adapter.fetchLatest({ nowIso: '2026-08-03T00:01:00.000Z' })

    expect(fetchImpl).toHaveBeenNthCalledWith(1, `${TELEGRAM_API_BASE}/botbot-token/getUpdates?allowed_updates=%5B%22channel_post%22%2C%22edited_channel_post%22%5D`)
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `${TELEGRAM_API_BASE}/botbot-token/getUpdates?allowed_updates=%5B%22channel_post%22%2C%22edited_channel_post%22%5D&offset=502`)
  })

  it('fails cleanly when Telegram rejects the request', async () => {
    const adapter = createTelegramAdapter({
      botToken: 'bot-token',
      channelIds: ['WarOfRightsHQ'],
      fetchImpl: vi.fn(async () => new Response('', { status: 401 })),
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' }))
      .rejects.toThrow('Telegram getUpdates request failed with status 401')
  })
})
