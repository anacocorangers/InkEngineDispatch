import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

const STEAM_APP_ID = '424030'
const STEAM_APP_FEED_URL = `https://store.steampowered.com/feeds/news/app/${STEAM_APP_ID}/?feed=steamnews.xml`

function unwrapCdata(value: string): string {
  return value.trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '')
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function stripHtml(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function extractTag(block: string, tagName: string): string | null {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'))
  if (!match) {
    return null
  }

  return decodeXml(unwrapCdata(match[1]))
}

function extractAttribute(block: string, attributeName: string): string | null {
  const match = block.match(new RegExp(`${attributeName}="([^"]+)"`, 'i'))
  return match ? decodeXml(match[1]) : null
}

function summarizeDescription(description: string): string {
  const summary = stripHtml(description)
  if (summary.length <= 260) {
    return summary
  }

  return `${summary.slice(0, 257).trimEnd()}...`
}

function extractYouTubeId(description: string): string | null {
  const decoded = decodeXml(description)
  const dataId = decoded.match(/data-youtube=["']+([\w-]{11})/i)?.[1]
  if (dataId) return dataId

  return decoded.match(/youtube(?:-nocookie)?\.com\/embed\/(?:&quot;|&amp;quot;|["'])*([\w-]{11})/i)?.[1] ?? null
}

function parseSteamFeed(xml: string): DispatchItem[] {
  const items: DispatchItem[] = []
  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)

  for (const match of matches) {
    const block = match[1]
    const title = extractTag(block, 'title')
    const description = extractTag(block, 'description')
    const link = extractTag(block, 'link')
    const pubDate = extractTag(block, 'pubDate')
    const thumbnailUrl = extractAttribute(block, 'url')
    const youtubeId = extractYouTubeId(description ?? '')

    if (!title || !description || !link || !pubDate) {
      continue
    }

    items.push({
      id: `steam:${STEAM_APP_ID}:${link}`,
      sourceId: 'steam',
      title,
      summary: summarizeDescription(description),
      url: link,
      thumbnailUrl: thumbnailUrl ?? undefined,
      embedUrl: youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : undefined,
      publishedAt: new Date(pubDate).toISOString(),
      tags: youtubeId
        ? ['steam', 'news', 'video', 'war-of-rights']
        : ['steam', 'news', 'war-of-rights'],
    })
  }

  return items
}

export const steamAdapter: SourceAdapter = {
  id: 'steam',
  async fetchLatest(context) {
    void context

    const response = await fetch(STEAM_APP_FEED_URL, {
      headers: {
        accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.1',
      },
    })

    if (!response.ok) {
      throw new Error(`Steam news feed request failed with status ${response.status}`)
    }

    const xml = await response.text()
    return parseSteamFeed(xml)
  },
}

export { parseSteamFeed, STEAM_APP_FEED_URL }
