import { describe, expect, it } from 'vitest'
import {
  SOURCE_DEFINITIONS,
  dispatchItemSchema,
  sourceDefinitionSchema,
} from '../src/index.js'

describe('contracts package', () => {
  it('defines all ecosystem source adapters', () => {
    expect(SOURCE_DEFINITIONS.map((source) => source.id)).toEqual([
      'youtube',
      'media',
      'twitch',
      'steam',
      'reddit',
      'official-site',
      'community-events',
      'discord',
      'tiktok',
      'x',
      'facebook',
      'instagram',
      'threads',
      'linkedin',
      'telegram',
      'pinterest',
      'snapchat',
      'tumblr',
    ])
  })

  it('keeps source definitions schema-safe', () => {
    for (const source of SOURCE_DEFINITIONS) {
      expect(() => sourceDefinitionSchema.parse(source)).not.toThrow()
    }
  })

  it('validates feed item shape', () => {
    const parsed = dispatchItemSchema.parse({
      id: 'demo-1',
      sourceId: 'steam',
      title: 'Server patch note',
      summary: 'A sample event for dashboard smoke testing.',
      url: 'https://example.com/post/demo-1',
      publishedAt: '2026-08-03T00:00:00.000Z',
      tags: ['sample', 'ops'],
    })

    expect(parsed.id).toBe('demo-1')
  })

  it('provides backward-compatible feed pagination defaults', async () => {
    const { feedResponseSchema } = await import('../src/index.js')
    const feed = feedResponseSchema.parse({
      generatedAt: '2026-08-03T00:00:00.000Z',
      items: [],
    })

    expect(feed.nextCursor).toBeNull()
    expect(feed.storage).toBe('memory')
  })
})
