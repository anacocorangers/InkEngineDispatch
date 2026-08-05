import type { DispatchItem } from '@inkengine/contracts'
import ICAL from 'ical.js'
import type { SourceAdapter } from './types.js'

type CommunityEventsAdapterOptions = {
  feedUrls?: string[]
  fetchImpl?: typeof fetch
  now?: () => Date
}

function getNextStart(event: InstanceType<typeof ICAL.Event>, now: Date) {
  if (!event.isRecurring()) return event.startDate.toJSDate()
  const iterator = event.iterator()
  for (let index = 0; index < 500; index += 1) {
    const occurrence = iterator.next()
    if (!occurrence) return null
    const occurrenceDate = occurrence.toJSDate()
    if (occurrenceDate.getTime() >= now.getTime() - 24 * 60 * 60 * 1000) return occurrenceDate
  }
  return null
}

export function parseCommunityCalendar(ics: string, feedUrl: string, now = new Date()): DispatchItem[] {
  const calendar = new ICAL.Component(ICAL.parse(ics))
  const cutoff = now.getTime() + 180 * 24 * 60 * 60 * 1000
  return calendar.getAllSubcomponents('vevent').flatMap((component): DispatchItem[] => {
    const event = new ICAL.Event(component)
    const start = getNextStart(event, now)
    if (!event.uid || !event.summary || !start || start.getTime() > cutoff) return []
    const eventUrl = component.getFirstPropertyValue('url')
    const url = typeof eventUrl === 'string' && /^https?:\/\//i.test(eventUrl) ? eventUrl : feedUrl
    const details = [event.description?.trim(), event.location ? `Location: ${event.location}.` : '']
      .filter(Boolean)
      .join(' ')

    return [{
      id: `${event.uid}:${start.toISOString()}`,
      sourceId: 'community-events',
      title: event.summary,
      summary: details || 'Scheduled War of Rights community event.',
      url,
      publishedAt: start.toISOString(),
      tags: ['community', 'event', 'calendar', 'war-of-rights'],
    }]
  })
}

export function createCommunityEventsAdapter(options: CommunityEventsAdapterOptions = {}): SourceAdapter {
  return {
    id: 'community-events',
    async fetchLatest() {
      const feedUrls = options.feedUrls
        ?? (process.env.COMMUNITY_EVENT_FEED_URLS ?? '').split(/[\n,]+/).map((url) => url.trim()).filter(Boolean)
      if (feedUrls.length === 0) return []
      const fetchImpl = options.fetchImpl ?? fetch
      const now = options.now?.() ?? new Date()
      const results = await Promise.allSettled(feedUrls.map(async (feedUrl) => {
        const response = await fetchImpl(feedUrl, { headers: { accept: 'text/calendar' } })
        if (!response.ok) throw new Error(`${new URL(feedUrl).hostname} returned ${response.status}`)
        return parseCommunityCalendar(await response.text(), feedUrl, now)
      }))
      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length === results.length) throw new Error('All community event feeds failed to refresh')
      return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    },
  }
}

export const communityEventsAdapter = createCommunityEventsAdapter()