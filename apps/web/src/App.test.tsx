import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { DispatchItem } from '@inkengine/contracts'
import App from './App'
import { buildYouTubeEmbedUrl, isHlsManifestUrl } from './youtube'
import { compareDispatchItems, isPlayableDispatchItem } from './relevance'

describe('App', () => {
  it('renders the dispatch title', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Dispatch.<wbr/>InkEngine.<wbr/>Live')
  })

  it('builds a YouTube embed URL with the hosting origin', () => {
    const url = new URL(buildYouTubeEmbedUrl(
      'https://www.youtube-nocookie.com/embed/DgUNMYK8WMs',
      'https://dispatch.inkengine.live',
    ))

    expect(url.origin).toBe('https://www.youtube.com')
    expect(url.pathname).toBe('/embed/DgUNMYK8WMs')
    expect(url.searchParams.get('autoplay')).toBe('1')
    expect(url.searchParams.get('playsinline')).toBe('1')
    expect(url.searchParams.get('origin')).toBe('https://dispatch.inkengine.live')
  })

  it('detects HLS manifests', () => {
    expect(isHlsManifestUrl('https://storage.googleapis.com/dispatch/videos/master.m3u8')).toBe(true)
    expect(isHlsManifestUrl('https://storage.googleapis.com/dispatch/videos/video.mp4')).toBe(false)
  })

  it('separates playable videos from articles', () => {
    const video: DispatchItem = {
      id: 'steam-video',
      sourceId: 'steam',
      title: 'Update video',
      summary: 'A Steam report with an embedded video.',
      url: 'https://example.com/video',
      thumbnailUrl: 'https://example.com/poster.jpg',
      embedUrl: 'https://www.youtube-nocookie.com/embed/DgUNMYK8WMs',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['steam', 'video', 'war-of-rights'],
    }
    const article: DispatchItem = {
      ...video,
      id: 'steam-article',
      title: 'Patch notes',
      thumbnailUrl: undefined,
      embedUrl: undefined,
      tags: ['steam', 'news', 'war-of-rights'],
    }

    expect(isPlayableDispatchItem(video)).toBe(true)
    expect(isPlayableDispatchItem(article)).toBe(false)
  })

  it('ranks War of Rights items ahead of generic bannerlord clips', () => {
    const wor: DispatchItem = {
      id: 'wor',
      sourceId: 'youtube',
      title: 'War of Rights - Grand Campaign',
      summary: 'A War of Rights battle.',
      url: 'https://example.com/wor',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['video', 'war-of-rights'],
    }

    const bannerlord: DispatchItem = {
      id: 'bannerlord',
      sourceId: 'youtube',
      title: 'Bannerlord highlights',
      summary: 'A clip from another game.',
      url: 'https://example.com/bannerlord',
      publishedAt: '2026-08-03T02:00:00.000Z',
      tags: ['video'],
    }

    expect(compareDispatchItems(wor, bannerlord)).toBeLessThan(0)
  })
})
