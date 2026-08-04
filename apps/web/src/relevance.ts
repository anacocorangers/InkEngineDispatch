import type { DispatchItem } from '@inkengine/contracts'

const warOfRightsPattern = /war\s*of\s*rights/i
const bannerlordPattern = /bannerlord/i

export function isPlayableDispatchItem(item: DispatchItem) {
  return Boolean(item.thumbnailUrl && (item.playbackUrl || item.embedUrl))
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