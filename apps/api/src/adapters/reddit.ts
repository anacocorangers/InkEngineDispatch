import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

const REDDIT_FEED_URL = 'https://www.reddit.com/r/WarOfRights/new/.rss'
const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const REDDIT_API_URL = 'https://oauth.reddit.com/r/WarOfRights/new?limit=25&raw_json=1'
const REDDIT_USER_AGENT = 'InkEngineDispatch/0.1 by u/anacocorangers'

type RedditAdapterOptions = {
  apiUrl?: string
  clientId?: string
  clientSecret?: string
  feedUrl?: string
  fetchImpl?: typeof fetch
  tokenUrl?: string
}

type RedditPost = {
  id?: string
  title?: string
  selftext?: string
  author?: string
  url?: string
  permalink?: string
  created_utc?: number
  thumbnail?: string
  preview?: { images?: Array<{ source?: { url?: string } }> }
  secure_media?: { reddit_video?: { hls_url?: string } }
  media?: { reddit_video?: { hls_url?: string } }
}

type RedditListing = {
  data?: { children?: Array<{ data?: RedditPost }> }
}

function decodeEntities(value: string) {
  return value
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function extractTag(block: string, tagName: string) {
  return block.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i'))?.[1]?.trim() ?? null
}

function extractAttribute(block: string, tagName: string, attributeName: string) {
  const tag = block.match(new RegExp(`<${tagName}\\s[^>]*>`, 'i'))?.[0]
  return tag?.match(new RegExp(`${attributeName}="([^"]+)"`, 'i'))?.[1] ?? null
}

function summarizeContent(content: string) {
  const text = decodeEntities(decodeEntities(content))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/\s+submitted by\s+/i)[0]
    .trim()
  const usefulText = text.replace(/(?:\[link\]|\[comments\])/gi, '').trim()
  if (!usefulText) return 'Community post from r/WarOfRights.'
  if (usefulText.length <= 260) return usefulText
  return `${usefulText.slice(0, 257).trimEnd()}...`
}

function extractYouTubeId(content: string) {
  const decoded = decodeEntities(decodeEntities(content))
  return decoded.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([\w-]{11})/i)?.[1] ?? null
}

function mapRedditPost(post: RedditPost): DispatchItem[] {
  if (!post.id || !post.title || !post.permalink || !post.created_utc) return []

  const outboundUrl = post.url ?? ''
  const youtubeId = extractYouTubeId(outboundUrl)
  const playbackUrl = post.secure_media?.reddit_video?.hls_url ?? post.media?.reddit_video?.hls_url
  const rawThumbnail = post.thumbnail?.startsWith('http')
    ? post.thumbnail
    : post.preview?.images?.[0]?.source?.url
  const hasVideo = Boolean(youtubeId || playbackUrl)

  return [{
    id: post.id,
    sourceId: 'reddit',
    title: post.title,
    summary: post.selftext?.trim()
      || (post.author ? `Posted by u/${post.author} in r/WarOfRights.` : 'Community post from r/WarOfRights.'),
    url: `https://www.reddit.com${post.permalink}`,
    thumbnailUrl: rawThumbnail ? decodeEntities(rawThumbnail) : undefined,
    playbackUrl,
    embedUrl: youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : undefined,
    publishedAt: new Date(post.created_utc * 1000).toISOString(),
    tags: hasVideo
      ? ['reddit', 'community', 'video', 'war-of-rights']
      : ['reddit', 'community', 'war-of-rights'],
  }]
}

export function parseRedditListing(payload: RedditListing): DispatchItem[] {
  return (payload.data?.children ?? []).flatMap((child) => child.data ? mapRedditPost(child.data) : [])
}

export function parseRedditFeed(xml: string): DispatchItem[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].flatMap((match): DispatchItem[] => {
    const entry = match[1]
    const id = extractTag(entry, 'id')?.replace(/^t3_/, '')
    const title = extractTag(entry, 'title')
    const content = extractTag(entry, 'content')
    const url = extractAttribute(entry, 'link', 'href')
    const publishedAt = extractTag(entry, 'published') ?? extractTag(entry, 'updated')
    if (!id || !title || !content || !url || !publishedAt) return []

    const thumbnailUrl = extractAttribute(entry, 'media:thumbnail', 'url')
    const youtubeId = extractYouTubeId(content)
    return [{
      id,
      sourceId: 'reddit',
      title: decodeEntities(title),
      summary: summarizeContent(content),
      url: decodeEntities(url),
      thumbnailUrl: thumbnailUrl ? decodeEntities(decodeEntities(thumbnailUrl)) : undefined,
      embedUrl: youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : undefined,
      publishedAt: new Date(publishedAt).toISOString(),
      tags: youtubeId
        ? ['reddit', 'community', 'video', 'war-of-rights']
        : ['reddit', 'community', 'war-of-rights'],
    }]
  })
}

export function createRedditAdapter(options: RedditAdapterOptions = {}): SourceAdapter {
  let accessToken: string | undefined
  let accessTokenExpiresAt = 0

  async function fetchWithOAuth(fetchImpl: typeof fetch, clientId: string, clientSecret: string) {
    if (!accessToken || Date.now() >= accessTokenExpiresAt) {
      const tokenResponse = await fetchImpl(options.tokenUrl ?? REDDIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': REDDIT_USER_AGENT,
        },
        body: 'grant_type=client_credentials',
      })
      if (!tokenResponse.ok) {
        throw new Error(`Reddit OAuth token request failed with status ${tokenResponse.status}`)
      }

      const tokenPayload = await tokenResponse.json() as { access_token?: string, expires_in?: number }
      if (!tokenPayload.access_token) throw new Error('Reddit OAuth token response did not include an access token')
      accessToken = tokenPayload.access_token
      accessTokenExpiresAt = Date.now() + Math.max(60, (tokenPayload.expires_in ?? 3600) - 60) * 1000
    }

    const response = await fetchImpl(options.apiUrl ?? REDDIT_API_URL, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${accessToken}`,
        'user-agent': REDDIT_USER_AGENT,
      },
    })
    if (!response.ok) throw new Error(`Reddit API request failed with status ${response.status}`)
    return parseRedditListing(await response.json() as RedditListing)
  }

  async function fetchWithRss(fetchImpl: typeof fetch) {
    const response = await fetchImpl(options.feedUrl ?? REDDIT_FEED_URL, {
      headers: {
        accept: 'application/atom+xml, application/xml;q=0.9, */*;q=0.1',
        'user-agent': REDDIT_USER_AGENT,
      },
    })
    if (!response.ok) throw new Error(`Reddit RSS request failed with status ${response.status}`)
    return parseRedditFeed(await response.text())
  }

  return {
    id: 'reddit',
    async fetchLatest() {
      const fetchImpl = options.fetchImpl ?? fetch
      const clientId = options.clientId ?? process.env.REDDIT_CLIENT_ID
      const clientSecret = options.clientSecret ?? process.env.REDDIT_CLIENT_SECRET ?? ''
      return clientId
        ? fetchWithOAuth(fetchImpl, clientId, clientSecret)
        : fetchWithRss(fetchImpl)
    },
  }
}

export const redditAdapter = createRedditAdapter()

export { REDDIT_API_URL, REDDIT_FEED_URL, REDDIT_TOKEN_URL, REDDIT_USER_AGENT }
