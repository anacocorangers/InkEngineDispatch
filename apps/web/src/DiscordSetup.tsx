import { useEffect, useState } from 'react'
import './DiscordSetup.css'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
type SetupGuild = { id: string; name: string; channels: Array<{ id: string; name: string }> }
type EventPreview = {
  accepted: boolean
  date?: string
  time?: string
  regiment?: string
  server?: string
  location?: string
  startsAt?: string
}

const eventTemplate = `Saturday Campaign Event
Date: August 12
Time: 8 PM Eastern
Regiment: 1st Maryland
Server: War of Rights Official
Map: Antietam`

function setupSession() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const incoming = hash.get('session')
  if (incoming) {
    sessionStorage.setItem('discord-setup-session', incoming)
    window.history.replaceState(null, '', window.location.pathname)
  }
  return incoming ?? sessionStorage.getItem('discord-setup-session')
}

export default function DiscordSetup() {
  const [session] = useState(setupSession)
  const [guilds, setGuilds] = useState<SetupGuild[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState(session
    ? 'Loading Discord servers...'
    : 'This setup link is missing or expired. Start again from Add to Discord.')
  const [saving, setSaving] = useState(false)
  const [previewContent, setPreviewContent] = useState(eventTemplate)
  const [preview, setPreview] = useState<EventPreview | null>(null)

  useEffect(() => {
    if (!session) return
    fetch(`${apiBaseUrl}/api/discord/setup`, { headers: { authorization: `Bearer ${session}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<{ guilds: SetupGuild[] }>
      })
      .then((payload) => {
        setGuilds(payload.guilds)
        setStatus(payload.guilds.length ? 'Choose the event channels Dispatch may read.' : 'No configurable servers with the bot installed were found.')
      })
      .catch(() => setStatus('Discord setup could not be loaded. Start again from Add to Discord.'))
  }, [session])

  function toggle(channelId: string) {
    setSelected((current) => current.includes(channelId)
      ? current.filter((id) => id !== channelId)
      : [...current, channelId])
  }

  async function save() {
    const session = sessionStorage.getItem('discord-setup-session')
    const selectedGuilds = guilds.map((guild) => ({
      guild,
      channelIds: selected.filter((channelId) => guild.channels.some((channel) => channel.id === channelId)),
    })).filter((selection) => selection.channelIds.length > 0)
    if (selectedGuilds.length === 0 || !session) return
    setSaving(true)
    try {
      const responses = await Promise.all(selectedGuilds.map(({ guild, channelIds }) => fetch(`${apiBaseUrl}/api/discord/setup`, {
          method: 'POST',
          headers: { authorization: `Bearer ${session}`, 'content-type': 'application/json' },
          body: JSON.stringify({ guildId: guild.id, channelIds }),
        })))
      if (responses.some((response) => !response.ok)) throw new Error()
      setStatus(`${selectedGuilds.map(({ guild }) => guild.name).join(', ')} connected. New event posts will be collected automatically.`)
      sessionStorage.removeItem('discord-setup-session')
    }
    catch {
      setStatus('Selected channels could not be saved. Please try again.')
    }
    finally {
      setSaving(false)
    }
  }

  async function previewPost() {
    const session = sessionStorage.getItem('discord-setup-session')
    if (!session) return
    const response = await fetch(`${apiBaseUrl}/api/discord/preview`, {
      method: 'POST',
      headers: { authorization: `Bearer ${session}`, 'content-type': 'application/json' },
      body: JSON.stringify({ content: previewContent }),
    })
    setPreview(response.ok ? await response.json() as EventPreview : null)
  }

  return (
    <main className='discord-setup-shell'>
      <header>
        <p>InkEngine Dispatch</p>
        <h1>Choose event channels</h1>
        <span>{status}</span>
      </header>
      {guilds.map((guild) => (
        <section key={guild.id}>
          <h2>{guild.name}</h2>
          {guild.channels.map((channel) => (
            <label key={channel.id}>
              <input type='checkbox' checked={selected.includes(channel.id)} onChange={() => toggle(channel.id)} />
              <span>#{channel.name}</span>
            </label>
          ))}
        </section>
      ))}
      <section className='event-preview'>
        <h2>Preview an event post</h2>
        <textarea value={previewContent} onChange={(event) => setPreviewContent(event.target.value)} rows={7} />
        <button type='button' onClick={() => void previewPost()}>Preview event</button>
        {preview && (
          <div className={preview.accepted ? 'preview-result accepted' : 'preview-result rejected'}>
            <strong>{preview.accepted ? 'Ready for Events' : 'This reads as chatter'}</strong>
            {preview.accepted && <span>{[preview.date, preview.time, preview.regiment, preview.server, preview.location].filter(Boolean).join(' · ') || 'Event signal detected'}</span>}
          </div>
        )}
      </section>
      <button type='button' disabled={selected.length === 0 || saving} onClick={() => void save()}>
        {saving ? 'Saving...' : 'Save selected channels'}
      </button>
      <a href='/'>Return to Dispatch</a>
    </main>
  )
}