import { describe, expect, it } from 'vitest'
import {
  createDiscordInstallUrl,
  createOAuthState,
  openSetupSession,
  sealSetupSession,
  verifyOAuthState,
} from '../src/discordOAuth.js'

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://api.example.com/api/discord/callback',
  setupUrl: 'https://example.com/discord/setup',
}

describe('Discord OAuth', () => {
  it('builds a least-privilege authorization URL with signed state', () => {
    const state = createOAuthState(config.clientSecret, 1_000)
    const url = new URL(createDiscordInstallUrl(config, state))

    expect(url.origin).toBe('https://discord.com')
    expect(url.searchParams.get('permissions')).toBe('66560')
    expect(url.searchParams.get('scope')).toBe('bot identify guilds')
    expect(verifyOAuthState(state, config.clientSecret, 1_001)).toBe(true)
    expect(verifyOAuthState(state, 'wrong-secret', 1_001)).toBe(false)
    expect(verifyOAuthState(state, config.clientSecret, 10 * 60_000 + 1_001)).toBe(false)
  })

  it('encrypts and expires setup sessions', () => {
    const sealed = sealSetupSession({ accessToken: 'discord-token', expiresAt: 10_000 }, config.clientSecret)

    expect(sealed).not.toContain('discord-token')
    expect(openSetupSession(sealed, config.clientSecret, 9_000)).toEqual({
      accessToken: 'discord-token',
      expiresAt: 10_000,
    })
    expect(openSetupSession(sealed, config.clientSecret, 10_001)).toBeNull()
  })
})