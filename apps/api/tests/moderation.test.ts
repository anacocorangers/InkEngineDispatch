import { describe, expect, it } from 'vitest'
import type { DispatchItem } from '@inkengine/contracts'
import { isAllowedDispatchItem } from '../src/moderation.js'

describe('moderation', () => {
  it('rejects explicitly removed Discord posts', () => {
    const item = {
      id: 'discord:1534637141991362581',
      sourceId: 'discord',
      title: 'test',
      summary: 'test',
      url: 'https://discord.com/channels/1519346055710376026/1534610594903232584/1534637141991362581',
      publishedAt: '2026-08-05T18:00:06.000Z',
      tags: ['discord', 'community', 'war-of-rights'],
    } as DispatchItem

    expect(isAllowedDispatchItem(item)).toBe(false)
  })

  it('rejects stale sample items from every source', () => {
    const item = {
      id: 'steam-sample',
      sourceId: 'steam',
      title: 'Steam adapter stub ready',
      summary: 'Sample payload.',
      url: 'https://example.com',
      publishedAt: '2026-08-03T00:00:00.000Z',
      tags: ['steam'],
    } as DispatchItem

    expect(isAllowedDispatchItem(item)).toBe(false)
  })

  it('rejects non-War of Rights video items', () => {
    const item = {
      id: 'clip-1',
      sourceId: 'youtube',
      title: 'Generic battlefield clip',
      summary: 'A random video clip.',
      url: 'https://example.com',
      publishedAt: '2026-08-03T00:00:00.000Z',
      tags: ['video'],
    } as DispatchItem

    expect(isAllowedDispatchItem(item)).toBe(false)
  })

  it('does not trust an adapter-assigned War of Rights tag', () => {
    const item = {
      id: 'bannerlord',
      sourceId: 'youtube',
      title: 'Bannerlord War Sails',
      summary: 'A video about another game.',
      url: 'https://example.com',
      publishedAt: '2026-08-03T00:00:00.000Z',
      tags: ['video', 'war-of-rights'],
    } as DispatchItem

    expect(isAllowedDispatchItem(item)).toBe(false)
  })

  it('allows War of Rights video items', () => {
    const item = {
      id: 'clip-2',
      sourceId: 'media',
      title: 'War of Rights - hosted clip',
      summary: 'A War of Rights highlight.',
      url: 'https://example.com',
      publishedAt: '2026-08-03T00:00:00.000Z',
      tags: ['video'],
    } as DispatchItem

    expect(isAllowedDispatchItem(item)).toBe(true)
  })
})