import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

const TUMBLR_API_BASE = 'https://api.tumblr.com/v2'

type TumblrAdapterOptions = {
  apiBase?: string
  apiKey?: string
  blogs?: string[]
  fetchImpl?: typeof fetch
}

type TumblrPhoto = { original_size?: { url?: string } }

type TumblrPost = {
  id?: number
  post_url?: string
  timestamp?: number
  summary?: string
  title?: string
  tags?: string[]
  type?: string
  photos?: TumblrPhoto[]
  blog_name?: string
}

type TumblrPostsResponse = {
  response?: { posts?: TumblrPost[] }
}

function truncate(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= 260) return text
  return `${text.slice(0, 257).trimEnd()}...`
}

export function mapTumblrPost(post: TumblrPost): DispatchItem[] {
  if (!post.id || !post.post_url || !post.timestamp) return []

  const thumbnailUrl = post.photos?.[0]?.original_size?.url
  const hasMedia = post.type === 'photo' || post.type === 'video' || Boolean(thumbnailUrl)

  return [{
    id: `tumblr:${post.id}`,
    sourceId: 'tumblr',
    title: post.title?.trim() || (post.blog_name ? `New post on ${post.blog_name}` : 'Tumblr community post'),
    summary: truncate(post.summary?.trim() || 'War of Rights community post from Tumblr.'),
    url: post.post_url,
    thumbnailUrl,
    publishedAt: new Date(post.timestamp * 1000).toISOString(),
    tags: [
      'tumblr',
      'community',
      ...(hasMedia ? ['media'] : []),
      'war-of-rights',
      ...(post.tags ?? []).slice(0, 3).map((tag) => tag.toLowerCase()),
    ],
  }]
}

export function parseTumblrPosts(payload: TumblrPostsResponse): DispatchItem[] {
  return (payload.response?.posts ?? []).flatMap(mapTumblrPost)
}

export function createTumblrAdapter(options: TumblrAdapterOptions = {}): SourceAdapter {
  return {
    id: 'tumblr',
    async fetchLatest() {
      const apiKey = options.apiKey ?? process.env.TUMBLR_API_KEY
      const blogs = options.blogs
        ?? (process.env.TUMBLR_BLOGS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
      if (!apiKey || blogs.length === 0) return []

      const fetchImpl = options.fetchImpl ?? fetch
      const apiBase = options.apiBase ?? TUMBLR_API_BASE
      const results = await Promise.allSettled(blogs.map(async (blog) => {
        const response = await fetchImpl(`${apiBase}/blog/${encodeURIComponent(blog)}/posts?api_key=${apiKey}&limit=20`)
        if (!response.ok) throw new Error(`Tumblr blog ${blog} request failed with status ${response.status}`)
        return parseTumblrPosts(await response.json() as TumblrPostsResponse)
      }))

      const failures = results.filter((result) => result.status === 'rejected')
      if (failures.length === results.length) throw new Error('All Tumblr blogs failed to refresh')
      return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    },
  }
}

export const tumblrAdapter = createTumblrAdapter()

export { TUMBLR_API_BASE }
