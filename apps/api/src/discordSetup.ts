export type DiscordSetupChannel = {
  id: string
  name: string
}

export type DiscordSetupGuild = {
  id: string
  name: string
  channels: DiscordSetupChannel[]
}

type DiscordGuild = {
  id?: string
  name?: string
  permissions?: string
}

type DiscordChannel = {
  id?: string
  name?: string
  type?: number
}

const ADMINISTRATOR = 1n << 3n
const MANAGE_GUILD = 1n << 5n

export function canConfigureGuild(permissions: string | undefined) {
  if (!permissions) return false
  const value = BigInt(permissions)
  return Boolean(value & (ADMINISTRATOR | MANAGE_GUILD))
}

export async function fetchDiscordSetupGuilds(
  accessToken: string,
  botToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscordSetupGuild[]> {
  const guildResponse = await fetchImpl('https://discord.com/api/v10/users/@me/guilds', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!guildResponse.ok) throw new Error(`Discord guild request failed with status ${guildResponse.status}`)
  const guilds = (await guildResponse.json() as DiscordGuild[])
    .filter((guild) => guild.id && guild.name && canConfigureGuild(guild.permissions))

  const configured = await Promise.all(guilds.map(async (guild): Promise<DiscordSetupGuild | null> => {
    const channelResponse = await fetchImpl(`https://discord.com/api/v10/guilds/${guild.id}/channels`, {
      headers: { authorization: `Bot ${botToken}` },
    })
    if (channelResponse.status === 403 || channelResponse.status === 404) return null
    if (!channelResponse.ok) throw new Error(`Discord channel request failed with status ${channelResponse.status}`)
    const channels = (await channelResponse.json() as DiscordChannel[])
      .filter((channel) => channel.id && channel.name && (channel.type === 0 || channel.type === 5))
      .map((channel) => ({ id: channel.id!, name: channel.name! }))
      .sort((left, right) => left.name.localeCompare(right.name))
    return { id: guild.id!, name: guild.name!, channels }
  }))

  return configured.filter((guild): guild is DiscordSetupGuild => Boolean(guild))
}