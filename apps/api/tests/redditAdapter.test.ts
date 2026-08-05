import { describe, expect, it, vi } from 'vitest'
import {
  createRedditAdapter,
  parseRedditFeed,
  parseRedditListing,
  REDDIT_API_URL,
  REDDIT_FEED_URL,
  REDDIT_TOKEN_URL,
} from '../src/adapters/reddit.js'

const feed = `
  <feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
    <entry>
      <content type="html">&lt;p&gt;A tactical breakdown.&lt;/p&gt; &lt;a href=&quot;https://youtu.be/DgUNMYK8WMs&quot;&gt;[link]&lt;/a&gt; submitted by /u/reporter</content>
      <id>t3_report1</id>
      <media:thumbnail url="https://preview.redd.it/poster.jpg?width=640&amp;amp;auto=webp" />
      <link href="https://www.reddit.com/r/WarOfRights/comments/report1/example/" />
      <published>2026-08-03T22:56:07+00:00</published>
      <title>Why The Defensive Army Must Move</title>
    </entry>
  </feed>
`

describe('reddit adapter', () => {
  it('maps OAuth posts including Reddit-hosted HLS video', () => {
    expect(parseRedditListing({
      data: {
        children: [{
          data: {
            id: 'native-video',
            title: 'A cavalry charge',
            author: 'reporter',
            url: 'https://v.redd.it/example',
            permalink: '/r/WarOfRights/comments/native-video/a_cavalry_charge/',
            created_utc: 1_785_800_000,
            thumbnail: 'https://preview.redd.it/poster.jpg',
            secure_media: { reddit_video: { hls_url: 'https://v.redd.it/example/HLSPlaylist.m3u8' } },
          },
        }],
      },
    })).toEqual([expect.objectContaining({
      id: 'native-video',
      summary: 'Posted by u/reporter in r/WarOfRights.',
      playbackUrl: 'https://v.redd.it/example/HLSPlaylist.m3u8',
      tags: ['reddit', 'community', 'video', 'war-of-rights'],
    })])
  })

  it('authenticates and fetches posts through Reddit OAuth', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { children: [] } })))
    const adapter = createRedditAdapter({ clientId: 'client', clientSecret: 'secret', fetchImpl })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toEqual([])
    expect(fetchImpl).toHaveBeenNthCalledWith(1, REDDIT_TOKEN_URL, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Basic Y2xpZW50OnNlY3JldA==' }),
      body: 'grant_type=client_credentials',
    }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, REDDIT_API_URL, expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer token' }),
    }))
  })

  it('maps subreddit RSS entries and embedded YouTube links', () => {
    expect(parseRedditFeed(feed)).toEqual([{
      id: 'report1',
      sourceId: 'reddit',
      title: 'Why The Defensive Army Must Move',
      summary: 'A tactical breakdown.',
      url: 'https://www.reddit.com/r/WarOfRights/comments/report1/example/',
      thumbnailUrl: 'https://preview.redd.it/poster.jpg?width=640&auto=webp',
      embedUrl: 'https://www.youtube-nocookie.com/embed/DgUNMYK8WMs',
      publishedAt: '2026-08-03T22:56:07.000Z',
      tags: ['reddit', 'community', 'video', 'war-of-rights'],
    }])
  })

  it('fetches the public subreddit RSS feed', async () => {
    const fetchImpl = vi.fn(async () => new Response(feed, { status: 200 }))
    const adapter = createRedditAdapter({ fetchImpl })

    expect(await adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith(REDDIT_FEED_URL, expect.objectContaining({
      headers: expect.objectContaining({
        'user-agent': 'InkEngineDispatch/0.1 by u/anacocorangers',
      }),
    }))
  })

  it('fails cleanly when Reddit rate limits the feed', async () => {
    const adapter = createRedditAdapter({
      fetchImpl: vi.fn(async () => new Response('', { status: 429 })),
    })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' }))
      .rejects.toThrow('Reddit RSS request failed with status 429')
  })
})