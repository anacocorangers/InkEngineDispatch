import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

describe('API config', () => {
  it('supports multiple allowed web origins', () => {
    const config = loadConfig({
      INKENGINE_WEB_ORIGIN: 'https://dispatch.inkengine.live;https://inkengine-dispatch.vercel.app',
    })

    expect(config.webOrigin).toEqual([
      'https://dispatch.inkengine.live',
      'https://inkengine-dispatch.vercel.app',
    ])
  })

  it('enables Discord OAuth only with its server-side configuration', () => {
    expect(loadConfig({}).discordOAuth).toBeUndefined()
    expect(loadConfig({
      DISCORD_CLIENT_SECRET: 'secret-value',
      DISCORD_OAUTH_REDIRECT_URI: 'https://api.example.com/api/discord/callback',
    }).discordOAuth).toEqual({
      clientId: '1534592543784964176',
      clientSecret: 'secret-value',
      redirectUri: 'https://api.example.com/api/discord/callback',
      setupUrl: 'https://dispatch.inkengine.live/discord/setup',
    })
  })
})