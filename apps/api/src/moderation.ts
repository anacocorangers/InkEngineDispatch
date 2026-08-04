import type { DispatchItem } from '@inkengine/contracts'

const blockedPatterns = [
  /\baimbot\b/i,
  /\bcheat(?:s|ing)?\b/i,
  /\bexploit(?:s|ing)?\b/i,
  /\bhack(?:s|ed|ing)?\b/i,
  /\bmalware\b/i,
  /\btrainer\b/i,
]

const warOfRightsPattern = /war\s*of\s*rights/i

function hasWarOfRightsMarker(item: DispatchItem) {
  if (item.tags.some((tag) => /war-of-rights|war of rights/i.test(tag))) return true
  return warOfRightsPattern.test(`${item.title}\n${item.summary}`)
}

export function isAllowedDispatchItem(item: DispatchItem) {
  if (item.sourceId === 'youtube' && item.id === 'youtube-sample') return false

  if (item.sourceId === 'youtube' || item.sourceId === 'media') {
    if (!hasWarOfRightsMarker(item)) return false
  }

  const searchableText = `${item.title}\n${item.summary}`
  return !blockedPatterns.some((pattern) => pattern.test(searchableText))
}