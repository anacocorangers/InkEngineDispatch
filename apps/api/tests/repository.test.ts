import type { DispatchItem } from '@inkengine/contracts'
import { describe, expect, it } from 'vitest'
import { getPostgresOptions, getPostgresUrl, MemoryPostRepository } from '../src/db/repository.js'

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
  it('uses the Cloud SQL socket from the database URL', () => {
    const databaseUrl
      = 'postgresql://app:secret@localhost/dispatch?host=%2Fcloudsql%2Fproject%3Aus-east1%3Adispatch'
    const options = getPostgresOptions(databaseUrl)

    expect(options.host).toBe('/cloudsql/project:us-east1:dispatch')
    expect(getPostgresUrl(databaseUrl)).toBe('postgresql://app:secret@localhost/dispatch')
    expect(getPostgresOptions('postgresql://app:secret@localhost/dispatch')).not.toHaveProperty('host')
  })

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

  it('hides previously stored blocked posts', async () => {
    const repository = new MemoryPostRepository()
    await repository.upsertPosts([
      createItem('normal', '2026-08-03T12:00:00.000Z'),
      {
        ...createItem('blocked', '2026-08-03T13:00:00.000Z'),
        title: 'Free cheat menu',
      },
      {
        ...createItem('youtube-sample', '2026-08-03T14:00:00.000Z'),
        sourceId: 'youtube',
      },
    ])

    const page = await repository.listPosts(10)
    expect(page.items.map((item) => item.id)).toEqual(['normal'])
  })

  it('hides archived rows from removed sources', async () => {
    const repository = new MemoryPostRepository()
    await repository.upsertPosts([{
      ...createItem('legacy-source', '2026-08-03T14:00:00.000Z'),
      sourceId: 'bluesky',
    } as unknown as DispatchItem])

    const page = await repository.listPosts(10)
    expect(page.items).toEqual([])
  })

  it('removes ended live streams without deleting recordings', async () => {
    const repository = new MemoryPostRepository()
    await repository.upsertPosts([
      { ...createItem('ended', '2026-08-03T14:00:00.000Z'), sourceId: 'youtube', title: 'War of Rights ended stream', tags: ['live', 'video', 'war-of-rights'] },
      { ...createItem('active', '2026-08-03T13:00:00.000Z'), sourceId: 'youtube', title: 'War of Rights active stream', tags: ['live', 'video', 'war-of-rights'] },
      { ...createItem('recording', '2026-08-03T12:00:00.000Z'), sourceId: 'youtube', title: 'War of Rights recording', tags: ['video', 'war-of-rights'] },
    ])

    await repository.removeStaleLivePosts('youtube', ['active'])

    const page = await repository.listPosts(10)
    expect(page.items.map((item) => item.id)).toEqual(['active', 'recording'])
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

  it('persists unique Discord channels by guild', async () => {
    const repository = new MemoryPostRepository()
    await repository.saveDiscordGuildChannels('guild-1', 'First', ['channel-1', 'channel-1'])
    await repository.saveDiscordGuildChannels('guild-2', 'Second', ['channel-2'])

    await expect(repository.listDiscordChannelIds()).resolves.toEqual(['channel-1', 'channel-2'])
  })

  it('persists source health records', async () => {
    const repository = new MemoryPostRepository()
    await repository.saveSourceHealth([{
      sourceId: 'discord',
      lastAttemptAt: '2026-08-05T20:00:00.000Z',
      lastSuccessfulSync: '2026-08-05T20:00:00.000Z',
      itemCount: 2,
      consecutiveFailures: 0,
      nextRetryAt: null,
      errorMessage: null,
    }])

    await expect(repository.listSourceHealth()).resolves.toEqual([
      expect.objectContaining({ sourceId: 'discord', itemCount: 2 }),
    ])
  })
})