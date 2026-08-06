import { describe, expect, it, vi } from 'vitest'
import { createDiscordAdapter, getDiscordEventPreview, getDiscordEventTags } from '../src/adapters/discord.js'

describe('discord adapter', () => {
  it('extracts event timing and context from Discord content', () => {
    expect(getDiscordEventTags([
      'Grand campaign event',
      'Date: August 12',
      'Time: 8 PM Eastern',
      'Regiment: 1st Maryland',
      'Server: War of Rights Official',
      'Map: Antietam',
    ].join('\n'))).toEqual(expect.arrayContaining([
      'event',
      'event-date:August 12',
      'event-time:8 PM Eastern',
      'event-regiment:1st Maryland',
      'event-server:War of Rights Official',
      'event-location:Antietam',
    ]))
  })

  it('previews whether a formatted post will enter Events', () => {
    expect(getDiscordEventPreview('Campaign muster\nDate: August 12\nTime: 8 PM\nServer: Official')).toEqual({
      accepted: true,
      date: 'August 12',
      time: '8 PM',
      regiment: undefined,
      server: 'Official',
      location: undefined,
      startsAt: undefined,
    })
    expect(getDiscordEventPreview('Thanks for playing')).toEqual(expect.objectContaining({ accepted: false }))
  })

  it('normalizes Discord timestamps and does not mark casual chatter as an event', () => {
    expect(getDiscordEventTags('Muster begins <t:1786492800:F>')).toContain('event-start:2026-08-12T00:00:00.000Z')
    expect(getDiscordEventTags('Dispatch Integration Test')).toContain('event')
    expect(getDiscordEventTags('Thanks for playing tonight')).not.toContain('event')
  })

  it('stays disabled without a bot token and selected channels', async () => {
    const fetchMock = vi.fn()
    const adapter = createDiscordAdapter({ fetchImpl: fetchMock })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-04T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('merges persisted and environment-selected channels without duplicates', async () => {
    const requestedChannels: string[] = []
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const channelId = String(url).match(/channels\/([^/]+)/)?.[1]
      if (channelId) requestedChannels.push(channelId)
      return new Response(JSON.stringify(String(url).endsWith('/messages?limit=50') ? [] : { guild_id: 'guild-1' }))
    })
    const adapter = createDiscordAdapter({
      botToken: 'test-token',
      channelIds: 'channel-1',
      loadChannelIds: async () => ['channel-1', 'channel-2'],
      fetchImpl: fetchMock,
    })

    await adapter.fetchLatest({ nowIso: '2026-08-05T00:00:00.000Z' })
    expect(new Set(requestedChannels)).toEqual(new Set(['channel-1', 'channel-2']))
  })

  it('loads selected channel messages through the official Discord API', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(
      String(url).endsWith('/messages?limit=50') ? [{
      id: 'message-1',
      channel_id: 'channel-1',
      guild_id: 'guild-1',
      content: 'War of Rights event tonight\nForm up at 8 PM.',
      timestamp: '2026-08-03T18:30:00.000Z',
      author: { username: 'Dispatch' },
      attachments: [{ url: 'https://cdn.discordapp.com/event.png', content_type: 'image/png' }],
      }] : { guild_id: 'guild-1' },
    ), { status: 200 }))
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

  it('keeps a link when Discord returns message metadata without content', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(
      String(url).endsWith('/messages?limit=50') ? [{
      id: 'message-2',
      channel_id: 'channel-1',
      content: '',
      timestamp: '2026-08-05T18:00:00.000Z',
      author: { username: 'Dispatch' },
      }] : { guild_id: 'guild-1' },
    ), { status: 200 }))
    const adapter = createDiscordAdapter({
      botToken: 'test-token',
      channelIds: 'channel-1',
      fetchImpl: fetchMock,
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-05T18:01:00.000Z' })).resolves.toEqual([
      expect.objectContaining({
        id: 'discord:message-2',
        title: 'Discord message',
        summary: 'Shared by Dispatch.',
        url: 'https://discord.com/channels/guild-1/channel-1/message-2',
      }),
    ])
  })
})