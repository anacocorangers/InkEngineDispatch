import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

export const officialSiteAdapter: SourceAdapter = {
  id: 'official-site',
  async fetchLatest(context) {
    const sample: DispatchItem = {
      id: 'official-sample',
      sourceId: 'official-site',
      title: 'Official site adapter stub ready',
      summary: 'Use RSS when available; fallback to selective HTML extraction.',
      url: 'https://example.com/',
      publishedAt: context.nowIso,
      tags: ['official', 'news'],
    }
    return [sample]
  },
}
