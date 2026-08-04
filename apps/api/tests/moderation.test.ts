import { describe, expect, it } from 'vitest'
import type { DispatchItem } from '@inkengine/contracts'
import { isAllowedDispatchItem } from '../src/moderation.js'

describe('moderation', () => {
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