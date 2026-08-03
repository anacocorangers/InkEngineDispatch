import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

export const tiktokAdapter: SourceAdapter = {
  id: 'tiktok',
  async fetchLatest() {
    const unavailable: DispatchItem[] = []
    return unavailable
  },
}
