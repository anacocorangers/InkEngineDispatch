import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SOURCE_DEFINITIONS, type DispatchItem } from '@inkengine/contracts'
import App from './App'
import { buildEmbedUrl, buildYouTubeEmbedUrl, isHlsManifestUrl } from './youtube'
import {
  compareDispatchItems,
  dedupeDispatchItems,
  getEventDetails,
  getSourceLabel,
  getVideoPosterUrl,
  isArticleDispatchItem,
  isEventDispatchItem,
  isLiveDispatchItem,
  isPlayableDispatchItem,
  isVideoDispatchItem,
  sourceLabels,
} from './relevance'

describe('App', () => {
  it('renders the dispatch title', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Dispatch.<wbr/>InkEngine.<wbr/>Live')
    expect(html).not.toContain('All dispatches')
    expect(html).toContain('Live now')
    expect(html).toContain('Events')
    expect(html).toContain('Add to Discord')
    expect(html).toContain('href="/api/discord/install"')
  })

  it('has a health-panel label for every registered source', () => {
    expect(Object.keys(sourceLabels)).toHaveLength(SOURCE_DEFINITIONS.length)
    expect(SOURCE_DEFINITIONS.every((source) => sourceLabels[source.id] === source.label)).toBe(true)
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

  it('builds a Twitch embed URL with its required parent host', () => {
    const url = new URL(buildEmbedUrl(
      'https://player.twitch.tv/?channel=example_regiment',
      'https://dispatch.inkengine.live',
    ))

    expect(url.searchParams.get('channel')).toBe('example_regiment')
    expect(url.searchParams.get('parent')).toBe('dispatch.inkengine.live')
    expect(url.searchParams.get('autoplay')).toBe('true')
  })

  it('keeps Steam reports with video in both content tabs', () => {
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
    expect(isArticleDispatchItem(video)).toBe(true)
    expect(isPlayableDispatchItem(article)).toBe(false)
    expect(isArticleDispatchItem(article)).toBe(true)
    expect(getSourceLabel(video)).toBe('Official Steam Update')
    expect(getVideoPosterUrl(video)).toBe('https://i.ytimg.com/vi/DgUNMYK8WMs/maxresdefault.jpg')
  })

  it('keeps the source thumbnail for non-YouTube video', () => {
    const video: DispatchItem = {
      id: 'hosted-video',
      sourceId: 'media',
      title: 'Hosted report',
      summary: 'A hosted video report.',
      url: 'https://example.com/report',
      thumbnailUrl: 'https://example.com/poster.jpg',
      playbackUrl: 'https://example.com/master.m3u8',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['video', 'war-of-rights'],
    }

    expect(getVideoPosterUrl(video)).toBe(video.thumbnailUrl)
  })

  it('shows only playable live-tagged items in the live tab', () => {
    const liveStream: DispatchItem = {
      id: 'live-stream',
      sourceId: 'twitch',
      title: 'War of Rights live battle',
      summary: 'Streaming now.',
      url: 'https://www.twitch.tv/example_regiment',
      thumbnailUrl: 'https://static-cdn.jtvnw.net/preview.jpg',
      embedUrl: 'https://player.twitch.tv/?channel=example_regiment',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['twitch', 'live', 'video', 'war-of-rights'],
    }

    expect(isLiveDispatchItem(liveStream)).toBe(true)
    expect(isVideoDispatchItem(liveStream)).toBe(false)
    expect(isLiveDispatchItem({ ...liveStream, tags: ['video', 'war-of-rights'] })).toBe(false)
    expect(isVideoDispatchItem({ ...liveStream, tags: ['video', 'war-of-rights'] })).toBe(true)
    expect(isLiveDispatchItem({ ...liveStream, thumbnailUrl: undefined, embedUrl: undefined })).toBe(false)
  })

  it('prefers an official Steam report over a duplicate YouTube item', () => {
    const steam: DispatchItem = {
      id: 'steam-report',
      sourceId: 'steam',
      title: 'Official update',
      summary: 'War of Rights update.',
      url: 'https://store.steampowered.com/news/app/424030/view/1',
      thumbnailUrl: 'https://example.com/poster.jpg',
      embedUrl: 'https://www.youtube-nocookie.com/embed/DgUNMYK8WMs',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['steam', 'video', 'war-of-rights'],
    }
    const youtube: DispatchItem = {
      ...steam,
      id: 'DgUNMYK8WMs',
      sourceId: 'youtube',
      url: 'https://www.youtube.com/watch?v=DgUNMYK8WMs',
    }

    expect(dedupeDispatchItems([youtube, steam])).toEqual([steam])
    expect(getSourceLabel(youtube)).toBe('Community Video')
  })

  it('prefers a Reddit discussion over a duplicate direct YouTube item', () => {
    const reddit: DispatchItem = {
      id: 'reddit-report',
      sourceId: 'reddit',
      title: 'Community analysis',
      summary: 'War of Rights discussion.',
      url: 'https://www.reddit.com/r/WarOfRights/comments/report/',
      thumbnailUrl: 'https://example.com/poster.jpg',
      embedUrl: 'https://www.youtube-nocookie.com/embed/DgUNMYK8WMs',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['reddit', 'community', 'video', 'war-of-rights'],
    }
    const youtube: DispatchItem = {
      ...reddit,
      id: 'DgUNMYK8WMs',
      sourceId: 'youtube',
      url: 'https://www.youtube.com/watch?v=DgUNMYK8WMs',
    }

    expect(dedupeDispatchItems([youtube, reddit])).toEqual([reddit])
    expect(isPlayableDispatchItem(reddit)).toBe(true)
    expect(isArticleDispatchItem(reddit)).toBe(false)
    expect(getSourceLabel(reddit)).toBe('Reddit Community')
  })

  it('keeps non-video Reddit posts in the article tab', () => {
    const redditArticle: DispatchItem = {
      id: 'reddit-article',
      sourceId: 'reddit',
      title: 'Community campaign report',
      summary: 'A written War of Rights discussion.',
      url: 'https://www.reddit.com/r/WarOfRights/comments/article/',
      publishedAt: '2026-08-03T01:00:00.000Z',
      tags: ['reddit', 'community', 'war-of-rights'],
    }

    expect(isPlayableDispatchItem(redditArticle)).toBe(false)
    expect(isArticleDispatchItem(redditArticle)).toBe(true)
  })

  it('routes Discord event reports exclusively to the events tab', () => {
    const event: DispatchItem = {
      id: 'discord:event',
      sourceId: 'discord',
      title: 'Grand campaign muster',
      summary: 'Form up at 8 PM.',
      url: 'https://discord.com/channels/guild/channel/message',
      publishedAt: '2026-08-05T18:00:00.000Z',
      tags: [
        'discord',
        'community',
        'war-of-rights',
        'event',
        'event-date:August 12',
        'event-time:8 PM Eastern',
        'event-regiment:1st Maryland',
        'event-server:War of Rights Official',
        'event-location:Antietam',
      ],
    }

    expect(isEventDispatchItem(event)).toBe(true)
    expect(isLiveDispatchItem(event)).toBe(false)
    expect(isVideoDispatchItem(event)).toBe(false)
    expect(isArticleDispatchItem(event)).toBe(false)
    expect(getSourceLabel(event)).toBe('Discord Event')
    expect(getEventDetails(event)).toEqual({
      date: 'August 12',
      time: '8 PM Eastern',
      regiment: '1st Maryland',
      server: 'War of Rights Official',
      location: 'Antietam',
    })
    expect(isEventDispatchItem({ ...event, tags: ['discord', 'community', 'war-of-rights'] })).toBe(false)
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
