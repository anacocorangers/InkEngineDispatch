import type { SourceId } from '@inkengine/contracts'
import type { SourceAdapter } from './types.js'

function createSocialAdapter(id: SourceId): SourceAdapter {
  return {
    id,
    async fetchLatest() {
      return []
    },
  }
}

export const xAdapter = createSocialAdapter('x')
export const facebookAdapter = createSocialAdapter('facebook')
export const instagramAdapter = createSocialAdapter('instagram')
export const threadsAdapter = createSocialAdapter('threads')
export const linkedinAdapter = createSocialAdapter('linkedin')
export const pinterestAdapter = createSocialAdapter('pinterest')
export const snapchatAdapter = createSocialAdapter('snapchat')