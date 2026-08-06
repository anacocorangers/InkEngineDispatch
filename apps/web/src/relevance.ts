import { SOURCE_DEFINITIONS, type DispatchItem } from '@inkengine/contracts'

const warOfRightsPattern = /war\s*of\s*rights/i
const bannerlordPattern = /bannerlord/i

export const sourceLabels = Object.fromEntries(
  SOURCE_DEFINITIONS.map((source) => [source.id, source.label]),
)

export function isPlayableDispatchItem(item: DispatchItem) {
  return Boolean(item.thumbnailUrl && (item.playbackUrl || item.embedUrl))
}

export function isEventDispatchItem(item: DispatchItem) {
  return item.sourceId === 'discord' && item.tags.includes('event')
}

function tagValue(item: DispatchItem, prefix: string) {
  return item.tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length)
}

export function getEventDetails(item: DispatchItem) {
  const eventStart = tagValue(item, 'event-start:')
  return {
    date: eventStart ? new Date(eventStart).toLocaleDateString(undefined, { dateStyle: 'long' }) : tagValue(item, 'event-date:'),
    time: eventStart ? new Date(eventStart).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : tagValue(item, 'event-time:'),
    regiment: tagValue(item, 'event-regiment:'),
    server: tagValue(item, 'event-server:'),
    location: tagValue(item, 'event-location:'),
  }
}

export function isLiveDispatchItem(item: DispatchItem) {
  return !isEventDispatchItem(item) && item.tags.includes('live') && isPlayableDispatchItem(item)
}

export function isVideoDispatchItem(item: DispatchItem) {
  return !isEventDispatchItem(item) && isPlayableDispatchItem(item) && !isLiveDispatchItem(item)
}

export function isArticleDispatchItem(item: DispatchItem) {
  return !isEventDispatchItem(item) && (item.sourceId === 'steam' || !isPlayableDispatchItem(item))
}

export function getYouTubeVideoId(item: DispatchItem) {
  const candidates = [item.embedUrl, item.url]
  for (const candidate of candidates) {
    const match = candidate?.match(/(?:embed\/|watch\?v=)([\w-]{11})/i)
    if (match) return match[1]
  }

  return null
}

export function getVideoPosterUrl(item: DispatchItem) {
  const videoId = getYouTubeVideoId(item)
  return videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : item.thumbnailUrl
}

export function dedupeDispatchItems(items: DispatchItem[]) {
  const sourcePriority: Partial<Record<DispatchItem['sourceId'], number>> = {
    steam: 3,
    reddit: 2,
    youtube: 1,
  }
  const preferredPriority = new Map<string, number>()
  for (const item of items) {
    const videoId = getYouTubeVideoId(item)
    if (!videoId) continue
    preferredPriority.set(videoId, Math.max(
      preferredPriority.get(videoId) ?? 0,
      sourcePriority[item.sourceId] ?? 0,
    ))
  }

  return items.filter((item) => {
    const videoId = getYouTubeVideoId(item)
    if (!videoId) return true
    return (sourcePriority[item.sourceId] ?? 0) >= (preferredPriority.get(videoId) ?? 0)
  })
}

export function getSourceLabel(item: DispatchItem) {
  if (item.sourceId === 'steam') return 'Official Steam Update'
  if (item.sourceId === 'official-site') return 'Official Development Update'
  if (item.sourceId === 'twitch') return 'Twitch Live'
  if (item.sourceId === 'community-events') return 'Community Event'
  if (item.sourceId === 'discord') return 'Discord Event'
  if (item.sourceId === 'reddit') return 'Reddit Community'
  if (item.sourceId === 'youtube') return 'Community Video'
  if (item.sourceId === 'media') return 'InkEngine Video'
  return item.sourceId.replaceAll('-', ' ')
}

export function rankDispatchItem(item: DispatchItem) {
  let score = 0
  const searchableText = `${item.title}\n${item.summary}`

  if (item.tags.some((tag) => /war-of-rights|war of rights/i.test(tag))) {
    score += 300
  }

  if (warOfRightsPattern.test(item.title)) score += 500
  if (warOfRightsPattern.test(searchableText)) score += 150
  if (item.sourceId === 'youtube') score += 20
  if (item.sourceId === 'media') score += 40
  if (bannerlordPattern.test(searchableText)) score -= 200

  return score
}

export function compareDispatchItems(left: DispatchItem, right: DispatchItem) {
  const scoreOrder = rankDispatchItem(right) - rankDispatchItem(left)
  if (scoreOrder !== 0) return scoreOrder

  const timeOrder = right.publishedAt.localeCompare(left.publishedAt)
  if (timeOrder !== 0) return timeOrder

  return right.id.localeCompare(left.id)
}