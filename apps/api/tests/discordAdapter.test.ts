import { describe, expect, it, vi } from 'vitest'
import { createDiscordAdapter } from '../src/adapters/discord.js'

describe('discord adapter', () => {
  it('stays disabled without a bot token and selected channels', async () => {
    const fetchMock = vi.fn()
    const adapter = createDiscordAdapter({ fetchImpl: fetchMock })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-04T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('loads selected channel messages through the official Discord API', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{
      id: 'message-1',
      channel_id: 'channel-1',
      guild_id: 'guild-1',
      content: 'War of Rights event tonight\nForm up at 8 PM.',
      timestamp: '2026-08-03T18:30:00.000Z',
      author: { username: 'Dispatch' },
      attachments: [{ url: 'https://cdn.discordapp.com/event.png', content_type: 'image/png' }],
    }]), { status: 200 }))
    const adapter = createDiscordAdapter({
      botToken: 'test-token',
      channelIds: 'channel-1',
      fetchImpl: fetchMock,
    })

    const items = await adapter.fetchLatest({ nowIso: '2026-08-04T00:00:00.000Z' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/messages?limit=50',
      expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bot test-token' }) }),
    )
    expect(items).toEqual([expect.objectContaining({
      id: 'discord:message-1',
      sourceId: 'discord',
      title: 'War of Rights event tonight',
      url: 'https://discord.com/channels/guild-1/channel-1/message-1',
      thumbnailUrl: 'https://cdn.discordapp.com/event.png',
      publishedAt: '2026-08-03T18:30:00.000Z',
    })])
  })
})