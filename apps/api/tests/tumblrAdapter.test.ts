import { describe, expect, it, vi } from 'vitest'
import { createTumblrAdapter, mapTumblrPost, parseTumblrPosts, TUMBLR_API_BASE } from '../src/adapters/tumblr.js'

const textPost = {
  id: 991,
  post_url: 'https://waroftrights.tumblr.com/post/991/patch-notes',
  timestamp: 1_785_800_000,
  summary: 'Patch notes for the latest War of Rights update.',
  title: 'Patch Notes',
  tags: ['WarOfRights', 'Patch', 'Community', 'Extra'],
  type: 'text',
  blog_name: 'waroftrights',
}

const photoPost = {
  id: 992,
  post_url: 'https://waroftrights.tumblr.com/post/992/screenshot',
  timestamp: 1_785_800_100,
  type: 'photo',
  blog_name: 'waroftrights',
  photos: [{ original_size: { url: 'https://64.media.tumblr.com/screenshot.jpg' } }],
}

describe('tumblr adapter', () => {
  it('maps a text post and truncates tags to three', () => {
    expect(mapTumblrPost(textPost)).toEqual([{
      id: 'tumblr:991',
      sourceId: 'tumblr',
      title: 'Patch Notes',
      summary: 'Patch notes for the latest War of Rights update.',
      url: 'https://waroftrights.tumblr.com/post/991/patch-notes',
      thumbnailUrl: undefined,
      publishedAt: '2026-08-03T23:33:20.000Z',
      tags: ['tumblr', 'community', 'war-of-rights', 'warofrights', 'patch', 'community'],
    }])
  })

  it('maps a photo post with a thumbnail and falls back to a generated title', () => {
    expect(mapTumblrPost(photoPost)).toEqual([expect.objectContaining({
      id: 'tumblr:992',
      title: 'New post on waroftrights',
      thumbnailUrl: 'https://64.media.tumblr.com/screenshot.jpg',
      tags: expect.arrayContaining(['media']),
    })])
  })

  it('skips posts missing required fields', () => {
    expect(mapTumblrPost({ id: 1 })).toEqual([])
  })

  it('parses the blog posts response envelope', () => {
    expect(parseTumblrPosts({ response: { posts: [textPost] } })).toHaveLength(1)
  })

  it('stays idle until an API key and blogs are configured', async () => {
    const fetchImpl = vi.fn()
    const adapter = createTumblrAdapter({ apiKey: '', blogs: [], fetchImpl })
    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('fetches posts for each configured blog', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ response: { posts: [textPost] } })))
    const adapter = createTumblrAdapter({ apiKey: 'key123', blogs: ['waroftrights.tumblr.com'], fetchImpl })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith(`${TUMBLR_API_BASE}/blog/waroftrights.tumblr.com/posts?api_key=key123&limit=20`)
  })

  it('tolerates a single blog failing while others succeed', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { posts: [textPost] } })))
    const adapter = createTumblrAdapter({
      apiKey: 'key123',
      blogs: ['missing-blog.tumblr.com', 'waroftrights.tumblr.com'],
      fetchImpl,
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toHaveLength(1)
  })

  it('fails cleanly when every configured blog fails', async () => {
    const adapter = createTumblrAdapter({
      apiKey: 'key123',
      blogs: ['missing-blog.tumblr.com'],
      fetchImpl: vi.fn(async () => new Response('', { status: 404 })),
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' }))
      .rejects.toThrow('All Tumblr blogs failed to refresh')
  })
})
