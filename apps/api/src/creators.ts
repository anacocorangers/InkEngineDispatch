import type { CreatorProfile } from '@inkengine/contracts'

// Hand-curated by the InkEngine Dispatch maintainers. Add an entry here and redeploy to feature a creator.
export const FEATURED_CREATORS: CreatorProfile[] = [
  {
    id: 'battle-line-network',
    name: 'Battle Line Network',
    description: 'War of Rights gameplay and community content.',
    tags: ['war-of-rights'],
    channels: [
      { platform: 'youtube', url: 'https://www.youtube.com/@BattleLineNetwork' },
    ],
  },
  {
    id: 'starsnbars',
    name: 'StarsNBars',
    description: 'War of Rights gameplay and community content.',
    tags: ['war-of-rights'],
    channels: [
      { platform: 'youtube', url: 'https://www.youtube.com/@StarsNBars1862' },
    ],
  },
]

export function getFeaturedCreators(): CreatorProfile[] {
  return FEATURED_CREATORS
}
