import { afterEach, describe, expect, it, vi } from 'vitest'
import { steamAdapter, parseSteamFeed } from '../src/adapters/steam.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('steam adapter', () => {
  it('parses the War of Rights app feed into dispatch items', () => {
    const items = parseSteamFeed(`
      <rss version="2.0">
        <channel>
          <item>
            <title>Update 200: Horses - Released!</title>
            <description><![CDATA[<div data-youtube="&quot;tADYOxDME7I" class="sharedFilePreviewYouTubeVideo"></div><p class="bb_paragraph">War of Rights update notes.</p><p class="bb_paragraph">Horses are live.</p>]]></description>
            <link><![CDATA[https://store.steampowered.com/news/app/424030/view/675126551624287466]]></link>
            <pubDate>Fri, 17 Jul 2026 17:17:21 +0000</pubDate>
            <enclosure url="https://clan.fastly.steamstatic.com/images/25965595/588e59dd4660e2ac0b737597ab81acb7b1790a66.png" length="0" type="image/png" />
          </item>
        </channel>
      </rss>
    `)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: 'steam:424030:https://store.steampowered.com/news/app/424030/view/675126551624287466',
      sourceId: 'steam',
      title: 'Update 200: Horses - Released!',
      summary: 'War of Rights update notes. Horses are live.',
      url: 'https://store.steampowered.com/news/app/424030/view/675126551624287466',
      thumbnailUrl: 'https://clan.fastly.steamstatic.com/images/25965595/588e59dd4660e2ac0b737597ab81acb7b1790a66.png',
      embedUrl: 'https://www.youtube-nocookie.com/embed/tADYOxDME7I',
      publishedAt: '2026-07-17T17:17:21.000Z',
      tags: ['steam', 'news', 'video', 'war-of-rights'],
    })
  })

  it('fetches the app feed from Steam', async () => {
    const fetchMock = vi.fn(async () => new Response(`
      <rss version="2.0">
        <channel>
          <item>
            <title>Update 200: Horses - Released!</title>
            <description><![CDATA[<p class="bb_paragraph">War of Rights update notes.</p>]]></description>
            <link><![CDATA[https://store.steampowered.com/news/app/424030/view/675126551624287466]]></link>
            <pubDate>Fri, 17 Jul 2026 17:17:21 +0000</pubDate>
            <enclosure url="https://clan.fastly.steamstatic.com/images/25965595/588e59dd4660e2ac0b737597ab81acb7b1790a66.png" length="0" type="image/png" />
          </item>
        </channel>
      </rss>
    `, { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const items = await steamAdapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://store.steampowered.com/feeds/news/app/424030/?feed=steamnews.xml',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.1',
        }),
      }),
    )
    expect(items).toHaveLength(1)
    expect(items[0]?.title).toBe('Update 200: Horses - Released!')
  })
})
