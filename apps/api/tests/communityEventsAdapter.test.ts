import { describe, expect, it, vi } from 'vitest'
import { createCommunityEventsAdapter, parseCommunityCalendar } from '../src/adapters/communityEvents.js'

const calendar = `BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:antietam-night\r
DTSTART:20260810T200000Z\r
DTEND:20260810T220000Z\r
SUMMARY:Antietam Campaign Night\r
DESCRIPTION:Organized 400-player battle.\r
LOCATION:War of Rights\r
URL:https://example-regiment.test/events/antietam\r
END:VEVENT\r
END:VCALENDAR\r
`

describe('community events adapter', () => {
  it('maps upcoming iCalendar events', () => {
    expect(parseCommunityCalendar(
      calendar,
      'https://example-regiment.test/calendar.ics',
      new Date('2026-08-03T00:00:00.000Z'),
    )).toEqual([expect.objectContaining({
      id: 'antietam-night:2026-08-10T20:00:00.000Z',
      sourceId: 'community-events',
      title: 'Antietam Campaign Night',
      url: 'https://example-regiment.test/events/antietam',
      publishedAt: '2026-08-10T20:00:00.000Z',
    })])
  })

  it('fetches selected calendar feeds', async () => {
    const fetchImpl = vi.fn(async () => new Response(calendar))
    const adapter = createCommunityEventsAdapter({
      feedUrls: ['https://example-regiment.test/calendar.ics'],
      fetchImpl,
      now: () => new Date('2026-08-03T00:00:00.000Z'),
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('stays idle until calendars are selected', async () => {
    const fetchImpl = vi.fn()
    const adapter = createCommunityEventsAdapter({ feedUrls: [], fetchImpl })
    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})