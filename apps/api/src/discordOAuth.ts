import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export type DiscordOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  setupUrl: string
}

type SetupSession = {
  accessToken: string
  expiresAt: number
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function signingKey(secret: string) {
  return createHmac('sha256', secret).update('inkengine-discord-oauth').digest()
}

export function createOAuthState(secret: string, now = Date.now()) {
  const payload = encode(JSON.stringify({ expiresAt: now + 10 * 60_000, nonce: encode(randomBytes(16)) }))
  const signature = encode(createHmac('sha256', signingKey(secret)).update(payload).digest())
  return `${payload}.${signature}`
}

export function verifyOAuthState(state: string, secret: string, now = Date.now()) {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) return false
  const expected = createHmac('sha256', signingKey(secret)).update(payload).digest()
  const supplied = Buffer.from(signature, 'base64url')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expiresAt?: number }
    return typeof parsed.expiresAt === 'number' && parsed.expiresAt >= now
  }
  catch {
    return false
  }
}

export function createDiscordInstallUrl(config: DiscordOAuthConfig, state: string) {
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('permissions', '66560')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', 'bot identify guilds')
  url.searchParams.set('state', state)
  return url.toString()
}

export function sealSetupSession(session: SetupSession, secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', signingKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()])
  return [encode(iv), encode(cipher.getAuthTag()), encode(encrypted)].join('.')
}

export function openSetupSession(value: string, secret: string, now = Date.now()): SetupSession | null {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split('.')
    if (!ivValue || !tagValue || !encryptedValue) return null
    const decipher = createDecipheriv('aes-256-gcm', signingKey(secret), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ])
    const session = JSON.parse(decrypted.toString('utf8')) as SetupSession
    return session.accessToken && session.expiresAt >= now ? session : null
  }
  catch {
    return null
  }
}