import { useEffect, useMemo, useState } from 'react'
import type { FeedResponse, SourceResponse } from '@inkengine/contracts'
import './App.css'

function App() {
  const [sources, setSources] = useState<SourceResponse | null>(null)
  const [feed, setFeed] = useState<FeedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [sourcesResponse, feedResponse] = await Promise.all([
          fetch('/api/sources'),
          fetch('/api/feed'),
        ])

        if (!sourcesResponse.ok || !feedResponse.ok) {
          throw new Error('Unable to load dispatch data from API.')
        }

        const [sourcesJson, feedJson] = await Promise.all([
          sourcesResponse.json() as Promise<SourceResponse>,
          feedResponse.json() as Promise<FeedResponse>,
        ])

        if (!active) return
        setSources(sourcesJson)
        setFeed(feedJson)
      }
      catch {
        if (active) {
          setError('Dispatch API is offline. Start apps/api and refresh.')
        }
      }
      finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadData()
    const timer = window.setInterval(loadData, 30_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  async function loadOlder() {
    if (!feed?.nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await fetch(`/api/feed?cursor=${encodeURIComponent(feed.nextCursor)}`)
      if (!response.ok) throw new Error('Unable to load older dispatches.')
      const page = await response.json() as FeedResponse
      setFeed((current) => current
        ? {
            ...page,
            items: [...current.items, ...page.items],
          }
        : page)
    }
    catch {
      setError('Older dispatches could not be loaded. Try again shortly.')
    }
    finally {
      setLoadingMore(false)
    }
  }

  const sourceHealth = useMemo(() => {
    if (!sources) return { ok: 0, degraded: 0, auth: 0 }
    return sources.sources.reduce(
      (totals, source) => {
        if (source.state === 'ok') totals.ok += 1
        if (source.state === 'degraded') totals.degraded += 1
        if (source.state === 'auth-required') totals.auth += 1
        return totals
      },
      { ok: 0, degraded: 0, auth: 0 },
    )
  }, [sources])

  return (
    <main className='dispatch-shell'>
      <header className='dispatch-header'>
        <div>
          <p className='eyebrow'>InkEngine Ecosystem Monitor</p>
          <h1>InkEngine Dispatch</h1>
          <p className='subtitle'>Live source observatory for campaign updates, releases, and community signals.</p>
        </div>
        <div className='pulse-chip'>
          <span className={loading ? 'dot pending' : error ? 'dot down' : 'dot live'} />
          <div>
            <strong>{error ? 'API Offline' : 'Live Feed'}</strong>
            <small>{feed ? `Updated ${new Date(feed.generatedAt).toLocaleTimeString()}` : 'Waiting for first sync'}</small>
            {feed && <small className='storage-label'>{feed.storage} storage</small>}
          </div>
        </div>
      </header>

      <section className='metrics-row'>
        <article>
          <span>Healthy</span>
          <strong>{sourceHealth.ok}</strong>
        </article>
        <article>
          <span>Degraded</span>
          <strong>{sourceHealth.degraded}</strong>
        </article>
        <article>
          <span>Auth Required</span>
          <strong>{sourceHealth.auth}</strong>
        </article>
        <article>
          <span>Feed Items</span>
          <strong>{feed?.items.length ?? 0}</strong>
        </article>
      </section>

      {error && <p className='error-banner'>{error}</p>}

      <section className='panel-grid'>
        <article className='panel'>
          <h2>Source Readiness</h2>
          <p className='panel-copy'>Adapters required for ecosystem coverage and their current integration state.</p>
          <ul className='source-list'>
            {sources?.sources.map((source) => (
              <li key={source.sourceId} className='source-row'>
                <div>
                  <strong>{source.sourceId}</strong>
                  <small>{source.message}</small>
                </div>
                <span className={`status-pill ${source.state}`}>{source.state}</span>
              </li>
            ))}
            {!sources && <li className='source-row'>Loading source status...</li>}
          </ul>
        </article>

        <article className='panel'>
          <h2>Dispatch Feed</h2>
          <p className='panel-copy'>Recent events from connected sources, sorted by publication time.</p>
          <ul className='feed-list'>
            {feed?.items.map((item) => (
              <li key={item.id} className='feed-item'>
                <div className='feed-head'>
                  <span className='source-tag'>{item.sourceId}</span>
                  <time>{new Date(item.publishedAt).toLocaleString()}</time>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <a href={item.url} target='_blank' rel='noreferrer'>View source</a>
              </li>
            ))}
            {feed?.items.length === 0 && <li className='feed-item'>No feed items yet.</li>}
          </ul>
          {feed?.nextCursor && (
            <button className='load-more-button' type='button' onClick={loadOlder} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load older dispatches'}
            </button>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
