import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

export const redditAdapter: SourceAdapter = {
  id: 'reddit',
  async fetchLatest(context) {
    const sample: DispatchItem = {
      id: 'reddit-sample',
      sourceId: 'reddit',
      title: 'Reddit adapter stub ready',
      summary: 'OAuth credentials increase request stability and quotas.',
      url: 'https://www.reddit.com/',
      publishedAt: context.nowIso,
      tags: ['reddit', 'community'],
    }
    return [sample]
  },
}
