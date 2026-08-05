import { describe, expect, it, vi } from 'vitest'
import { createOfficialSiteAdapter, OFFICIAL_NEWS_API, parseOfficialNews } from '../src/adapters/officialSite.js'

const payload = {
  Articles: [{
    ArticleId: '1838407329260212',
    PreviewImage: '/Content/Images/NewsPreviews/horses.webp',
    Title: 'Update 200: Horses - Released!',
    Month: 7,
    Day: 17,
    Year: 2026,
    Blurb: 'Horses officially arrive on the battlefields.',
    Author: '[CG]TrustyJam',
  }],
}

describe('official site adapter', () => {
  it('maps official news previews', () => {
    expect(parseOfficialNews(payload)).toEqual([{
      id: '1838407329260212',
      sourceId: 'official-site',
      title: 'Update 200: Horses - Released!',
      summary: 'Horses officially arrive on the battlefields. Filed by [CG]TrustyJam.',
      url: 'https://warofrights.com/News/1838407329260212',
      thumbnailUrl: 'https://warofrights.com/Content/Images/NewsPreviews/horses.webp',
      publishedAt: '2026-07-17T00:00:00.000Z',
      tags: ['official', 'news', 'war-of-rights'],
    }])
  })

  it('fetches the official structured endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload)))
    const adapter = createOfficialSiteAdapter({ fetchImpl })

    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' })).resolves.toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith(OFFICIAL_NEWS_API, expect.any(Object))
  })

  it('reports official endpoint failures', async () => {
    const adapter = createOfficialSiteAdapter({
      fetchImpl: vi.fn(async () => new Response('', { status: 503 })),
    })
    await expect(adapter.fetchLatest({ nowIso: '2026-08-03T00:00:00.000Z' }))
      .rejects.toThrow('Official news request failed with status 503')
  })
})