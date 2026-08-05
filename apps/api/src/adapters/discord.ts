import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

type DiscordMessage = {
  id?: string
  channel_id?: string
  guild_id?: string
  content?: string
  timestamp?: string
  author?: { username?: string }
  attachments?: Array<{ url?: string; content_type?: string }>
}

type DiscordAdapterOptions = {
  botToken?: string
  channelIds?: string
  fetchImpl?: typeof fetch
}

export function createDiscordAdapter(options: DiscordAdapterOptions = {}): SourceAdapter {
  return {
    id: 'discord',
    async fetchLatest() {
      const botToken = options.botToken ?? process.env.DISCORD_BOT_TOKEN
      const channelIds = (options.channelIds ?? process.env.DISCORD_CHANNEL_IDS)
        ?.split(',')
        .map((channelId) => channelId.trim())
        .filter(Boolean) ?? []
      if (!botToken || channelIds.length === 0) return []

      const fetchImpl = options.fetchImpl ?? fetch
      const messages = await Promise.all(channelIds.map(async (channelId) => {
        const response = await fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, {
          headers: {
            accept: 'application/json',
            authorization: `Bot ${botToken}`,
          },
        })
        if (!response.ok) {
          throw new Error(`Discord channel ${channelId} request failed with status ${response.status}`)
        }
        return await response.json() as DiscordMessage[]
      }))

      return messages.flat().flatMap((message): DispatchItem[] => {
        if (!message.id || !message.channel_id || !message.guild_id || !message.timestamp) return []
        const content = message.content?.trim()
        const firstAttachment = message.attachments?.[0]
        if (!content && !firstAttachment?.url) return []

        return [{
          id: `discord:${message.id}`,
          sourceId: 'discord',
          title: content?.split(/\r?\n/, 1)[0].slice(0, 120) || 'Discord attachment',
          summary: content || `Shared by ${message.author?.username ?? 'a Discord member'}.`,
          url: `https://discord.com/channels/${message.guild_id}/${message.channel_id}/${message.id}`,
          thumbnailUrl: firstAttachment?.content_type?.startsWith('image/') ? firstAttachment.url : undefined,
          publishedAt: new Date(message.timestamp).toISOString(),
          tags: ['discord', 'community', 'war-of-rights'],
        }]
      })
    },
  }
}

export const discordAdapter = createDiscordAdapter()
