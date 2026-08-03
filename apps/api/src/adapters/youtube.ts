import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

export const youtubeAdapter: SourceAdapter = {
  id: 'youtube',
  async fetchLatest(context) {
    const sample: DispatchItem = {
      id: 'youtube-sample',
      sourceId: 'youtube',
      title: 'YouTube adapter stub ready',
      summary: 'Connect YouTube Data API key to replace sample payloads.',
      url: 'https://youtube.com/',
      publishedAt: context.nowIso,
      tags: ['video', 'stub'],
    }
    return [sample]
  },
}
