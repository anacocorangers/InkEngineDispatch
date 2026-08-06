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

type DiscordChannel = {
  guild_id?: string
}

type DiscordAdapterOptions = {
  botToken?: string
  channelIds?: string
  loadChannelIds?: () => Promise<string[]>
  fetchImpl?: typeof fetch
}

const eventSignalPattern = /\b(event|muster|battle|campaign|drill|reenactment|operation|form(?:ing)? up|formation|match|integration test)\b/i

function labeledValue(content: string, labels: string[]) {
  const labelPattern = labels.join('|')
  return content.match(new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*:\\s*([^\\n]+)`, 'i'))?.[1]?.trim()
}

export function getDiscordEventTags(content: string) {
  const tags = ['discord', 'community', 'war-of-rights']
  const discordTimestamp = content.match(/<t:(\d{10})(?::[tTdDfFR])?>/)?.[1]
  const date = labeledValue(content, ['date', 'day'])
  const time = labeledValue(content, ['time'])
  const regiment = labeledValue(content, ['regiment', 'unit', 'host'])
  const server = labeledValue(content, ['server'])
  const location = labeledValue(content, ['location', 'map'])

  if (eventSignalPattern.test(content) || discordTimestamp || date || time) tags.push('event')
  if (discordTimestamp) tags.push(`event-start:${new Date(Number(discordTimestamp) * 1000).toISOString()}`)
  if (date) tags.push(`event-date:${date}`)
  if (time) tags.push(`event-time:${time}`)
  if (regiment) tags.push(`event-regiment:${regiment}`)
  if (server) tags.push(`event-server:${server}`)
  if (location) tags.push(`event-location:${location}`)

  return tags
}

function eventTagValue(tags: string[], prefix: string) {
  return tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length)
}

export function getDiscordEventPreview(content: string) {
  const tags = getDiscordEventTags(content.trim())
  return {
    accepted: tags.includes('event'),
    date: eventTagValue(tags, 'event-date:'),
    time: eventTagValue(tags, 'event-time:'),
    regiment: eventTagValue(tags, 'event-regiment:'),
    server: eventTagValue(tags, 'event-server:'),
    location: eventTagValue(tags, 'event-location:'),
    startsAt: eventTagValue(tags, 'event-start:'),
  }
}

export function createDiscordAdapter(options: DiscordAdapterOptions = {}): SourceAdapter {
  return {
    id: 'discord',
    async fetchLatest() {
      const botToken = options.botToken ?? process.env.DISCORD_BOT_TOKEN
      const configuredChannelIds = (options.channelIds ?? process.env.DISCORD_CHANNEL_IDS)
        ?.split(',')
        .map((channelId) => channelId.trim())
        .filter(Boolean) ?? []
      const channelIds = [...new Set([
        ...configuredChannelIds,
        ...(await options.loadChannelIds?.() ?? []),
      ])]
      if (!botToken || channelIds.length === 0) return []

      const fetchImpl = options.fetchImpl ?? fetch
      const messages = await Promise.all(channelIds.map(async (channelId) => {
        const headers = {
          accept: 'application/json',
          authorization: `Bot ${botToken}`,
        }
        const [channelResponse, messagesResponse] = await Promise.all([
          fetchImpl(`https://discord.com/api/v10/channels/${channelId}`, { headers }),
          fetchImpl(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, { headers }),
        ])
        if (!channelResponse.ok) {
          throw new Error(`Discord channel ${channelId} metadata request failed with status ${channelResponse.status}`)
        }
        if (!messagesResponse.ok) {
          throw new Error(`Discord channel ${channelId} request failed with status ${messagesResponse.status}`)
        }
        const channel = await channelResponse.json() as DiscordChannel
        const channelMessages = await messagesResponse.json() as DiscordMessage[]
        return channelMessages.map((message) => ({
          ...message,
          channel_id: message.channel_id ?? channelId,
          guild_id: message.guild_id ?? channel.guild_id,
        }))
      }))

      return messages.flat().flatMap((message): DispatchItem[] => {
        if (!message.id || !message.channel_id || !message.guild_id || !message.timestamp) return []
        const content = message.content?.trim()
        const firstAttachment = message.attachments?.[0]

        return [{
          id: `discord:${message.id}`,
          sourceId: 'discord',
          title: content?.split(/\r?\n/, 1)[0].slice(0, 120)
            || (firstAttachment?.url ? 'Discord attachment' : 'Discord message'),
          summary: content || `Shared by ${message.author?.username ?? 'a Discord member'}.`,
          url: `https://discord.com/channels/${message.guild_id}/${message.channel_id}/${message.id}`,
          thumbnailUrl: firstAttachment?.content_type?.startsWith('image/') ? firstAttachment.url : undefined,
          publishedAt: new Date(message.timestamp).toISOString(),
          tags: getDiscordEventTags(content ?? ''),
        }]
      })
    },
  }
}

export const discordAdapter = createDiscordAdapter()
