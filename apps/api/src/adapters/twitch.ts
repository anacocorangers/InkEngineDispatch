import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const TWITCH_SEARCH_URL = 'https://api.twitch.tv/helix/search/channels?query=War%20of%20Rights&live_only=true&first=20'

type TwitchChannel = {
  id?: string
  broadcaster_login?: string
  display_name?: string
  game_name?: string
  is_live?: boolean
  thumbnail_url?: string
  title?: string
  started_at?: string
}

type TwitchAdapterOptions = {
  clientId?: string
  clientSecret?: string
  fetchImpl?: typeof fetch
  searchUrl?: string
  tokenUrl?: string
}

export function parseTwitchChannels(channels: TwitchChannel[]): DispatchItem[] {
  return channels.flatMap((channel): DispatchItem[] => {
    if (!channel.is_live || !channel.id || !channel.broadcaster_login || !channel.started_at) return []
    const displayName = channel.display_name?.trim() || channel.broadcaster_login
    const thumbnailUrl = channel.thumbnail_url
      ?.replace('{width}', '640')
      .replace('{height}', '360')

    return [{
      id: `${channel.id}:${channel.started_at}`,
      sourceId: 'twitch',
      title: channel.title?.trim() || `${displayName} is live with War of Rights`,
      summary: `${displayName} is streaming ${channel.game_name || 'War of Rights'} live on Twitch.`,
      url: `https://www.twitch.tv/${channel.broadcaster_login}`,
      thumbnailUrl,
      embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(channel.broadcaster_login)}`,
      publishedAt: new Date(channel.started_at).toISOString(),
      tags: ['twitch', 'live', 'video', 'war-of-rights'],
    }]
  })
}

export function createTwitchAdapter(options: TwitchAdapterOptions = {}): SourceAdapter {
  let accessToken: string | undefined
  let accessTokenExpiresAt = 0

  return {
    id: 'twitch',
    async fetchLatest() {
      const clientId = options.clientId ?? process.env.TWITCH_CLIENT_ID
      const clientSecret = options.clientSecret ?? process.env.TWITCH_CLIENT_SECRET
      if (!clientId || !clientSecret) return []
      const fetchImpl = options.fetchImpl ?? fetch

      if (!accessToken || Date.now() >= accessTokenExpiresAt) {
        const tokenUrl = new URL(options.tokenUrl ?? TWITCH_TOKEN_URL)
        tokenUrl.search = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }).toString()
        const tokenResponse = await fetchImpl(tokenUrl, { method: 'POST' })
        if (!tokenResponse.ok) throw new Error(`Twitch OAuth request failed with status ${tokenResponse.status}`)
        const token = await tokenResponse.json() as { access_token?: string; expires_in?: number }
        if (!token.access_token) throw new Error('Twitch OAuth response did not include an access token')
        accessToken = token.access_token
        accessTokenExpiresAt = Date.now() + Math.max(60, (token.expires_in ?? 3600) - 60) * 1000
      }

      const response = await fetchImpl(options.searchUrl ?? TWITCH_SEARCH_URL, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'client-id': clientId,
        },
      })
      if (!response.ok) throw new Error(`Twitch search request failed with status ${response.status}`)
      const payload = await response.json() as { data?: TwitchChannel[] }
      return parseTwitchChannels(payload.data ?? [])
    },
  }
}

export const twitchAdapter = createTwitchAdapter()

export { TWITCH_SEARCH_URL, TWITCH_TOKEN_URL }