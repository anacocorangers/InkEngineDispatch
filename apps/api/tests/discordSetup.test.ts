import { describe, expect, it, vi } from 'vitest'
import { canConfigureGuild, fetchDiscordSetupGuilds } from '../src/discordSetup.js'

describe('Discord setup', () => {
  it('requires Manage Server or Administrator permissions', () => {
    expect(canConfigureGuild('32')).toBe(true)
    expect(canConfigureGuild('8')).toBe(true)
    expect(canConfigureGuild('0')).toBe(false)
  })

  it('lists text channels only for guilds the user can configure and the bot can access', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith('/users/@me/guilds')) return new Response(JSON.stringify([
        { id: 'guild-1', name: 'Authorized', permissions: '32' },
        { id: 'guild-2', name: 'Member only', permissions: '0' },
      ]))
      return new Response(JSON.stringify([
        { id: 'channel-voice', name: 'Voice', type: 2 },
        { id: 'channel-events', name: 'events', type: 0 },
      ]))
    })

    await expect(fetchDiscordSetupGuilds('user-token', 'bot-token', fetchMock)).resolves.toEqual([{
      id: 'guild-1',
      name: 'Authorized',
      channels: [{ id: 'channel-events', name: 'events' }],
    }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})