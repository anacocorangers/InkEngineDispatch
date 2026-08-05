import { describe, expect, it } from 'vitest'
import { SOURCE_DEFINITIONS, type DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from '../src/adapters/types.js'
import { MemoryPostRepository } from '../src/db/repository.js'
import { buildFeed, buildSourceStatuses, sourceAdapters, type RuntimeSourceHealth } from '../src/feedService.js'

describe('feed service', () => {
  it('registers an adapter for every source definition', () => {
    expect(sourceAdapters.map((adapter) => adapter.id)).toEqual(
      SOURCE_DEFINITIONS.map((source) => source.id),
    )
  })

  it('returns a feed payload with generated timestamp', async () => {
    const feed = await buildFeed(new Date('2026-08-03T00:00:00.000Z'))
    expect(feed.generatedAt).toBe('2026-08-03T00:00:00.000Z')
    expect(feed.items.length).toBeGreaterThan(0)
  })

  it('reports auth requirements in source status output', async () => {
    const sources = await buildSourceStatuses(new Date('2026-08-03T00:00:00.000Z'))
    const discord = sources.sources.find((source) => source.sourceId === 'discord')
    expect(discord?.state).toBe('auth-required')
  })

  it('reports selected-target sources as awaiting configuration', async () => {
    const sources = await buildSourceStatuses(new Date('2026-08-03T00:00:00.000Z'))

    expect(sources.sources.find((source) => source.sourceId === 'community-events')).toMatchObject({
      state: 'auth-required',
      message: 'Select regiment calendar URLs with COMMUNITY_EVENT_FEED_URLS.',
    })
  })

  it('keeps cached reports and backs off a failing source', async () => {
    const repository = new MemoryPostRepository()
    const healthRegistry = new Map<string, RuntimeSourceHealth>()
    const report: DispatchItem = {
      id: 'cached-report',
      sourceId: 'reddit',
      title: 'Cached report',
      summary: 'War of Rights community report.',
      url: 'https://www.reddit.com/r/WarOfRights/comments/cached-report/',
      publishedAt: '2026-08-03T00:00:00.000Z',
      tags: ['reddit', 'war-of-rights'],
    }
    let shouldFail = false
    let attempts = 0
    const adapter: SourceAdapter = {
      id: 'reddit',
      async fetchLatest() {
        attempts += 1
        if (shouldFail) throw new Error('Reddit unavailable')
        return [report]
      },
    }

    await buildFeed(new Date('2026-08-03T00:00:00.000Z'), repository, {
      adapters: [adapter],
      healthRegistry,
    })
    shouldFail = true
    const failedRefresh = await buildFeed(new Date('2026-08-03T00:01:00.000Z'), repository, {
      adapters: [adapter],
      healthRegistry,
    })
    const duringBackoff = await buildFeed(new Date('2026-08-03T00:01:30.000Z'), repository, {
      adapters: [adapter],
      healthRegistry,
    })
    const reddit = (await buildSourceStatuses(new Date('2026-08-03T00:01:30.000Z'), healthRegistry))
      .sources.find((source) => source.sourceId === 'reddit')

    expect(failedRefresh.items).toContainEqual(report)
    expect(duringBackoff.items).toContainEqual(report)
    expect(attempts).toBe(2)
    expect(reddit).toMatchObject({
      state: 'degraded',
      itemCount: 1,
      consecutiveFailures: 1,
      lastSuccessfulSync: '2026-08-03T00:00:00.000Z',
      nextRetryAt: '2026-08-03T00:02:00.000Z',
    })
    expect(reddit?.message).toContain('Serving last-known-good reports.')
  })
})
