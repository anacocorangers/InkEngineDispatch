import { describe, expect, it } from 'vitest'
import { SOURCE_DEFINITIONS } from '@inkengine/contracts'
import { buildFeed, buildSourceStatuses, sourceAdapters } from '../src/feedService.js'

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
})
