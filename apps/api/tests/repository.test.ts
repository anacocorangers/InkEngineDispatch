import type { DispatchItem } from '@inkengine/contracts'
import { describe, expect, it } from 'vitest'
import { MemoryPostRepository } from '../src/db/repository.js'

function createItem(id: string, publishedAt: string): DispatchItem {
  return {
    id,
    sourceId: 'reddit',
    title: `Post ${id}`,
    summary: `Summary for ${id}`,
    url: `https://example.com/posts/${id}`,
    publishedAt,
    tags: ['war-of-rights'],
  }
}

describe('post repository', () => {
  it('upserts duplicate source posts', async () => {
    const repository = new MemoryPostRepository()
    await repository.upsertPosts([
      createItem('same-post', '2026-08-03T12:00:00.000Z'),
      { ...createItem('same-post', '2026-08-03T12:00:00.000Z'), title: 'Updated title' },
    ])

    const page = await repository.listPosts(10)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.title).toBe('Updated title')
  })

  it('paginates newest-first without duplicates', async () => {
    const repository = new MemoryPostRepository()
    await repository.upsertPosts([
      createItem('oldest', '2026-08-03T10:00:00.000Z'),
      createItem('middle', '2026-08-03T11:00:00.000Z'),
      createItem('newest', '2026-08-03T12:00:00.000Z'),
    ])

    const first = await repository.listPosts(2)
    const second = await repository.listPosts(2, first.nextCursor ?? undefined)

    expect(first.items.map((item) => item.id)).toEqual(['newest', 'middle'])
    expect(second.items.map((item) => item.id)).toEqual(['oldest'])
    expect(second.nextCursor).toBeNull()
  })
})