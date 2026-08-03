import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

export const steamAdapter: SourceAdapter = {
  id: 'steam',
  async fetchLatest(context) {
    const sample: DispatchItem = {
      id: 'steam-sample',
      sourceId: 'steam',
      title: 'Steam adapter stub ready',
      summary: 'Replace with app news endpoint aggregation for release notes.',
      url: 'https://store.steampowered.com/news/',
      publishedAt: context.nowIso,
      tags: ['steam', 'patch'],
    }
    return [sample]
  },
}
