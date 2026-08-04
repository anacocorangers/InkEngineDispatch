import type { DispatchItem } from '@inkengine/contracts'

const blockedPatterns = [
  /\baimbot\b/i,
  /\bcheat(?:s|ing)?\b/i,
  /\bexploit(?:s|ing)?\b/i,
  /\bhack(?:s|ed|ing)?\b/i,
  /\bmalware\b/i,
  /\btrainer\b/i,
]

export function isAllowedDispatchItem(item: DispatchItem) {
  if (item.sourceId === 'youtube' && item.id === 'youtube-sample') return false

  const searchableText = `${item.title}\n${item.summary}`
  return !blockedPatterns.some((pattern) => pattern.test(searchableText))
}