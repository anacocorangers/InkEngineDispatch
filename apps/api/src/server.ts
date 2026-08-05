import Fastify from 'fastify'
import cors from '@fastify/cors'
import { loadConfig } from './config.js'
import { buildFeed, buildSourceStatuses } from './feedService.js'
import { createPostRepository } from './db/repository.js'

const config = loadConfig()
const postRepository = createPostRepository(config.databaseUrl)

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

app.get('/api/sources', async () => {
  return buildSourceStatuses()
})

app.get<{ Querystring: { cursor?: string; limit?: string } }>('/api/feed', async (request) => {
  const requestedLimit = Number(request.query.limit ?? config.feedPageSize)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
    : config.feedPageSize

  return buildFeed(new Date(), postRepository, {
    cursor: request.query.cursor,
    limit,
  })
})

app.post('/api/refresh', async () => {
  const feed = await buildFeed(new Date(), postRepository, {
    limit: 100,
  })
  return {
    feed,
    sources: await buildSourceStatuses(),
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
