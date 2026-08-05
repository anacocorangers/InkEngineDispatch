import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

const OFFICIAL_NEWS_API = 'https://warofrights.com/API/Media/GetNewsArticlePreviews?count=10&page=1'
const OFFICIAL_SITE_ORIGIN = 'https://warofrights.com'

type OfficialArticle = {
  ArticleId?: string
  PreviewImage?: string
  Title?: string
  Month?: number
  Day?: number
  Year?: number
  Blurb?: string
  Author?: string
}

type OfficialNewsResponse = {
  Articles?: OfficialArticle[]
}

type OfficialSiteAdapterOptions = {
  apiUrl?: string
  fetchImpl?: typeof fetch
}

export function parseOfficialNews(payload: OfficialNewsResponse): DispatchItem[] {
  return (payload.Articles ?? []).flatMap((article): DispatchItem[] => {
    if (!article.ArticleId || !article.Title || !article.Year || !article.Month || !article.Day) return []
    const previewImage = article.PreviewImage
      ? new URL(article.PreviewImage, OFFICIAL_SITE_ORIGIN).toString()
      : undefined
    const author = article.Author?.trim()
    const blurb = article.Blurb?.replace(/\s+/g, ' ').trim()

    return [{
      id: article.ArticleId,
      sourceId: 'official-site',
      title: article.Title,
      summary: [blurb || 'Official War of Rights development update.', author ? `Filed by ${author}.` : '']
        .filter(Boolean)
        .join(' '),
      url: `${OFFICIAL_SITE_ORIGIN}/News/${article.ArticleId}`,
      thumbnailUrl: previewImage,
      publishedAt: new Date(Date.UTC(article.Year, article.Month - 1, article.Day)).toISOString(),
      tags: ['official', 'news', 'war-of-rights'],
    }]
  })
}

export function createOfficialSiteAdapter(options: OfficialSiteAdapterOptions = {}): SourceAdapter {
  return {
    id: 'official-site',
    async fetchLatest() {
      const response = await (options.fetchImpl ?? fetch)(options.apiUrl ?? OFFICIAL_NEWS_API, {
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`Official news request failed with status ${response.status}`)
      return parseOfficialNews(await response.json() as OfficialNewsResponse)
    },
  }
}

export const officialSiteAdapter = createOfficialSiteAdapter()

export { OFFICIAL_NEWS_API }
