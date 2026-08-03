import type { DispatchItem } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

export const discordAdapter: SourceAdapter = {
  id: 'discord',
  async fetchLatest() {
    const unavailable: DispatchItem[] = []
    return unavailable
  },
}
