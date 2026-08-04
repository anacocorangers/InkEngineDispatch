import { z } from 'zod'

export const sourceIdSchema = z.enum([
  'youtube',
  'twitch',
  'steam',
  'reddit',
  'official-site',
  'discord',
  'tiktok',
  'x',
  'facebook',
  'instagram',
  'threads',
  'bluesky',
  'mastodon',
  'linkedin',
  'telegram',
  'pinterest',
  'snapchat',
  'tumblr',
])

export type SourceId = z.infer<typeof sourceIdSchema>

export const authRequirementSchema = z.enum(['none', 'optional', 'required'])
export type AuthRequirement = z.infer<typeof authRequirementSchema>

export const sourceDefinitionSchema = z.object({
  id: sourceIdSchema,
  label: z.string(),
  authRequirement: authRequirementSchema,
  statusNote: z.string(),
})

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>

export const dispatchItemSchema = z.object({
  id: z.string(),
  sourceId: sourceIdSchema,
  title: z.string(),
  summary: z.string(),
  url: z.url(),
  thumbnailUrl: z.url().optional(),
  playbackUrl: z.url().optional(),
  embedUrl: z.url().optional(),
  publishedAt: z.iso.datetime(),
  tags: z.array(z.string()),
})

export type DispatchItem = z.infer<typeof dispatchItemSchema>

export const feedResponseSchema = z.object({
  generatedAt: z.iso.datetime(),
  items: z.array(dispatchItemSchema),
  nextCursor: z.string().nullable().default(null),
  storage: z.enum(['memory', 'postgres']).default('memory'),
})

export type FeedResponse = z.infer<typeof feedResponseSchema>

export const sourceStatusSchema = z.object({
  sourceId: sourceIdSchema,
  state: z.enum(['ok', 'degraded', 'auth-required']),
  message: z.string(),
  lastSync: z.iso.datetime(),
})

export type SourceStatus = z.infer<typeof sourceStatusSchema>

export const sourceResponseSchema = z.object({
  generatedAt: z.iso.datetime(),
  sources: z.array(sourceStatusSchema),
})

export type SourceResponse = z.infer<typeof sourceResponseSchema>

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    authRequirement: 'optional',
    statusNote: 'Uses channel and playlist APIs when key is provided.',
  },
  {
    id: 'twitch',
    label: 'Twitch',
    authRequirement: 'required',
    statusNote: 'Requires a Twitch application client ID and access token.',
  },
  {
    id: 'steam',
    label: 'Steam News',
    authRequirement: 'none',
    statusNote: 'Public feed requests are available without authentication.',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    authRequirement: 'optional',
    statusNote: 'Public JSON is available, OAuth unlocks richer limits.',
  },
  {
    id: 'official-site',
    label: 'Official Site',
    authRequirement: 'none',
    statusNote: 'RSS or page scrape strategy depends on source format.',
  },
  {
    id: 'discord',
    label: 'Discord',
    authRequirement: 'required',
    statusNote: 'Requires bot token and server permissions.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    authRequirement: 'required',
    statusNote: 'Requires approved API access and credentials.',
  },
  {
    id: 'x',
    label: 'X',
    authRequirement: 'required',
    statusNote: 'Requires an X API project and bearer token.',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    authRequirement: 'required',
    statusNote: 'Requires Meta Graph API access to the target Page.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    authRequirement: 'required',
    statusNote: 'Requires the Instagram Graph API and a professional account.',
  },
  {
    id: 'threads',
    label: 'Threads',
    authRequirement: 'required',
    statusNote: 'Requires approved Threads API credentials.',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    authRequirement: 'none',
    statusNote: 'Public profiles and posts are available through the AT Protocol.',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    authRequirement: 'none',
    statusNote: 'Public account timelines are available from the account instance.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    authRequirement: 'required',
    statusNote: 'Requires approved LinkedIn organization API access.',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    authRequirement: 'required',
    statusNote: 'Requires a bot token and access to the target channel.',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    authRequirement: 'required',
    statusNote: 'Requires Pinterest API application credentials.',
  },
  {
    id: 'snapchat',
    label: 'Snapchat',
    authRequirement: 'required',
    statusNote: 'Requires approved Snap Kit or Public Profile API access.',
  },
  {
    id: 'tumblr',
    label: 'Tumblr',
    authRequirement: 'optional',
    statusNote: 'Public blogs can be read with an API key; OAuth supports private access.',
  },
]
