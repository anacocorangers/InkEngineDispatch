import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

const TELEGRAM_API_BASE = 'https://api.telegram.org'

type TelegramAdapterOptions = {
  apiBase?: string
  botToken?: string
  channelIds?: string[]
  fetchImpl?: typeof fetch
}

type TelegramChat = { id?: number, username?: string, title?: string }

type TelegramMessage = {
  message_id?: number
  date?: number
  text?: string
  caption?: string
  photo?: unknown[]
  video?: unknown
  chat?: TelegramChat
}

type TelegramUpdate = {
  update_id: number
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
}

type TelegramGetUpdatesResponse = {
  ok: boolean
  result?: TelegramUpdate[]
  description?: string
}

function normalizeChannelId(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function summarizeText(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return 'War of Rights update posted to Telegram.'
  if (text.length <= 260) return text
  return `${text.slice(0, 257).trimEnd()}...`
}

function buildMessageUrl(chat: TelegramChat, messageId: number): string {
  if (chat.username) return `https://t.me/${chat.username}/${messageId}`
  // Private supergroup/channel numeric IDs use the -100 prefixed internal form for t.me/c links.
  const internalId = String(chat.id ?? 0).replace(/^-100/, '').replace(/^-/, '')
  return `https://t.me/c/${internalId}/${messageId}`
}

function mapMessage(message: TelegramMessage): DispatchItem[] {
  const chat = message.chat
  if (!chat?.id || !message.message_id || !message.date) return []

  const text = message.text ?? message.caption ?? ''
  const hasMedia = Boolean(message.photo?.length || message.video)

  return [{
    id: `telegram:${chat.id}:${message.message_id}`,
    sourceId: 'telegram',
    title: chat.title ? `${chat.title} update` : 'Telegram channel update',
    summary: summarizeText(text),
    url: buildMessageUrl(chat, message.message_id),
    publishedAt: new Date(message.date * 1000).toISOString(),
    tags: hasMedia
      ? ['telegram', 'community', 'media', 'war-of-rights']
      : ['telegram', 'community', 'war-of-rights'],
  }]
}

export function parseTelegramUpdates(updates: TelegramUpdate[], allowedChannels: Set<string>): DispatchItem[] {
  return updates.flatMap((update) => {
    const message = update.channel_post ?? update.edited_channel_post
    const chat = message?.chat
    if (!message || !chat) return []

    const username = chat.username ? normalizeChannelId(chat.username) : null
    const chatId = chat.id !== undefined ? String(chat.id) : null
    const isAllowed = (username !== null && allowedChannels.has(username))
      || (chatId !== null && allowedChannels.has(chatId))
    return isAllowed ? mapMessage(message) : []
  })
}

export function createTelegramAdapter(options: TelegramAdapterOptions = {}): SourceAdapter {
  let lastUpdateId = 0

  return {
    id: 'telegram',
    async fetchLatest() {
      const botToken = options.botToken ?? process.env.TELEGRAM_BOT_TOKEN
      const channelIds = options.channelIds
        ?? (process.env.TELEGRAM_CHANNEL_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
      if (!botToken || channelIds.length === 0) return []

      const allowedChannels = new Set(channelIds.map(normalizeChannelId))
      const fetchImpl = options.fetchImpl ?? fetch
      const apiBase = options.apiBase ?? TELEGRAM_API_BASE
      const params = new URLSearchParams({ allowed_updates: JSON.stringify(['channel_post', 'edited_channel_post']) })
      if (lastUpdateId > 0) params.set('offset', String(lastUpdateId + 1))

      const response = await fetchImpl(`${apiBase}/bot${botToken}/getUpdates?${params.toString()}`)
      if (!response.ok) throw new Error(`Telegram getUpdates request failed with status ${response.status}`)

      const payload = await response.json() as TelegramGetUpdatesResponse
      if (!payload.ok) throw new Error(payload.description ?? 'Telegram getUpdates request was rejected')

      const updates = payload.result ?? []
      if (updates.length > 0) {
        lastUpdateId = updates.reduce((max, update) => Math.max(max, update.update_id), lastUpdateId)
      }

      return parseTelegramUpdates(updates, allowedChannels)
    },
  }
}

export const telegramAdapter = createTelegramAdapter()

export { TELEGRAM_API_BASE }
