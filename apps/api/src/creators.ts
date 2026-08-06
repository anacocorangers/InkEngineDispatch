import type { CreatorProfile } from '@inkengine/contracts'

// Hand-curated by the InkEngine Dispatch maintainers. Add an entry here and redeploy to feature a creator.
export const FEATURED_CREATORS: CreatorProfile[] = []

export function getFeaturedCreators(): CreatorProfile[] {
  return FEATURED_CREATORS
}
