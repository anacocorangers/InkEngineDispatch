import { config as loadEnv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
loadEnv({ path: resolve(projectRoot, '.env'), quiet: true })

export type ApiConfig = {
  port: number
  host: string
  webOrigin: string | string[]
  databaseUrl?: string
  feedPageSize: number
  discordOAuth?: {
    clientId: string
    clientSecret: string
    redirectUri: string
    setupUrl: string
  }
}

export function parseWebOrigin(value = 'http://127.0.0.1:5173') {
  const origins = value.split(/[;,]/).map((origin) => origin.trim()).filter(Boolean)
  return origins.length === 1 ? origins[0] : origins
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const discordClientId = env.DISCORD_CLIENT_ID ?? '1534592543784964176'
  const discordClientSecret = env.DISCORD_CLIENT_SECRET
  const discordRedirectUri = env.DISCORD_OAUTH_REDIRECT_URI
  const discordSetupUrl = env.DISCORD_SETUP_URL ?? 'https://dispatch.inkengine.live/discord/setup'
  return {
    port: Number(env.PORT ?? env.INKENGINE_API_PORT ?? 8787),
    host: env.INKENGINE_API_HOST ?? (env.K_SERVICE ? '0.0.0.0' : '127.0.0.1'),
    webOrigin: parseWebOrigin(env.INKENGINE_WEB_ORIGIN),
    databaseUrl: env.DATABASE_URL,
    feedPageSize: Number(env.INKENGINE_FEED_PAGE_SIZE ?? 20),
    discordOAuth: discordClientSecret && discordRedirectUri
      ? {
          clientId: discordClientId,
          clientSecret: discordClientSecret,
          redirectUri: discordRedirectUri,
          setupUrl: discordSetupUrl,
        }
      : undefined,
  }
}
