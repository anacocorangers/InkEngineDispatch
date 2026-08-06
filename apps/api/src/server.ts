import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadConfig } from './config.js'
import { buildFeed, buildSourceStatuses } from './feedService.js'
import { createPostRepository } from './db/repository.js'
import {
  createDiscordInstallUrl,
  createOAuthState,
  sealSetupSession,
  verifyOAuthState,
  openSetupSession,
} from './discordOAuth.js'
import { fetchDiscordSetupGuilds } from './discordSetup.js'
import { createDiscordAdapter, getDiscordEventPreview } from './adapters/discord.js'
import { sourceAdapters } from './feedService.js'

const config = loadConfig()
const postRepository = createPostRepository(config.databaseUrl)
const runtimeAdapters = sourceAdapters.map((adapter) => adapter.id === 'discord'
  ? createDiscordAdapter({ loadChannelIds: () => postRepository.listDiscordChannelIds() })
  : adapter)

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: config.webOrigin,
})

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'inkengine-dispatch-api',
    storage: postRepository.storage,
    now: new Date().toISOString(),
  }
})

app.get('/api/discord/install', async (_request, reply) => {
  if (!config.discordOAuth) return reply.code(503).send({ message: 'Discord onboarding is not configured.' })
  const state = createOAuthState(config.discordOAuth.clientSecret)
  return reply.redirect(createDiscordInstallUrl(config.discordOAuth, state))
})

app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/api/discord/callback', async (request, reply) => {
  const oauth = config.discordOAuth
  if (!oauth) return reply.code(503).send({ message: 'Discord onboarding is not configured.' })
  if (request.query.error) return reply.redirect(`${oauth.setupUrl}?error=${encodeURIComponent(request.query.error)}`)
  if (!request.query.code || !request.query.state || !verifyOAuthState(request.query.state, oauth.clientSecret)) {
    return reply.code(400).send({ message: 'Invalid or expired Discord authorization.' })
  }

  const body = new URLSearchParams({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    grant_type: 'authorization_code',
    code: request.query.code,
    redirect_uri: oauth.redirectUri,
  })
  const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenResponse.ok) return reply.code(502).send({ message: 'Discord authorization could not be completed.' })
  const token = await tokenResponse.json() as { access_token?: string; expires_in?: number }
  if (!token.access_token) return reply.code(502).send({ message: 'Discord did not return an access token.' })
  const session = sealSetupSession({
    accessToken: token.access_token,
    expiresAt: Date.now() + Math.min(token.expires_in ?? 3600, 3600) * 1000,
  }, oauth.clientSecret)
  return reply.redirect(`${oauth.setupUrl}#session=${encodeURIComponent(session)}`)
})

app.get('/api/discord/setup', async (request, reply) => {
  const oauth = config.discordOAuth
  const authorization = request.headers.authorization
  const session = oauth && authorization?.startsWith('Bearer ')
    ? openSetupSession(authorization.slice('Bearer '.length), oauth.clientSecret)
    : null
  if (!session) return reply.code(401).send({ message: 'Discord setup authorization is invalid or expired.' })
  if (!process.env.DISCORD_BOT_TOKEN) return reply.code(503).send({ message: 'Discord bot access is not configured.' })

  return { guilds: await fetchDiscordSetupGuilds(session.accessToken, process.env.DISCORD_BOT_TOKEN) }
})

app.post<{ Body: { guildId?: string; channelIds?: string[] } }>('/api/discord/setup', async (request, reply) => {
  const oauth = config.discordOAuth
  const authorization = request.headers.authorization
  const session = oauth && authorization?.startsWith('Bearer ')
    ? openSetupSession(authorization.slice('Bearer '.length), oauth.clientSecret)
    : null
  if (!session) return reply.code(401).send({ message: 'Discord setup authorization is invalid or expired.' })
  if (!process.env.DISCORD_BOT_TOKEN) return reply.code(503).send({ message: 'Discord bot access is not configured.' })
  if (
    typeof request.body?.guildId !== 'string'
    || !Array.isArray(request.body.channelIds)
    || request.body.channelIds.length < 1
    || request.body.channelIds.length > 100
    || request.body.channelIds.some((channelId) => typeof channelId !== 'string' || !/^\d{15,22}$/.test(channelId))
  ) {
    return reply.code(400).send({ message: 'Discord server and channel selections are invalid.' })
  }
  const guilds = await fetchDiscordSetupGuilds(session.accessToken, process.env.DISCORD_BOT_TOKEN)
  const guild = guilds.find((candidate) => candidate.id === request.body.guildId)
  const channelIds = [...new Set(request.body.channelIds ?? [])]
  const allowedChannelIds = new Set(guild?.channels.map((channel) => channel.id) ?? [])
  if (!guild || channelIds.length === 0 || channelIds.some((channelId) => !allowedChannelIds.has(channelId))) {
    return reply.code(400).send({ message: 'Choose at least one channel from an authorized Discord server.' })
  }
  await postRepository.saveDiscordGuildChannels(guild.id, guild.name, channelIds)
  return { saved: true, guildId: guild.id, channelIds }
})

app.post<{ Body: { content?: string } }>('/api/discord/preview', async (request, reply) => {
  const oauth = config.discordOAuth
  const authorization = request.headers.authorization
  const session = oauth && authorization?.startsWith('Bearer ')
    ? openSetupSession(authorization.slice('Bearer '.length), oauth.clientSecret)
    : null
  if (!session) return reply.code(401).send({ message: 'Discord setup authorization is invalid or expired.' })
  if (typeof request.body?.content !== 'string' || request.body.content.length > 4_000) {
    return reply.code(400).send({ message: 'Event preview content must be 4,000 characters or fewer.' })
  }
  return getDiscordEventPreview(request.body.content)
})

app.get('/api/sources', async () => {
  return buildSourceStatuses(new Date(), undefined, postRepository)
})

app.get<{ Querystring: { cursor?: string; limit?: string } }>('/api/feed', async (request) => {
  const requestedLimit = Number(request.query.limit ?? config.feedPageSize)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
    : config.feedPageSize

  return buildFeed(new Date(), postRepository, {
    cursor: request.query.cursor,
    limit,
    adapters: runtimeAdapters,
  })
})

app.post('/api/refresh', async () => {
  const feed = await buildFeed(new Date(), postRepository, {
    limit: 100,
    adapters: runtimeAdapters,
  })
  return {
    feed,
    sources: await buildSourceStatuses(new Date(), undefined, postRepository),
  }
})

try {
  await app.listen({ host: config.host, port: config.port })
  console.log(`InkEngine Dispatch API listening on http://${config.host}:${config.port}`)
}
catch (error) {
  app.log.error(error)
  process.exit(1)
}
