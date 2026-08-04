import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import type { DispatchItem, FeedResponse, SourceResponse } from '@inkengine/contracts'
import { buildYouTubeEmbedUrl, isHlsManifestUrl } from './youtube'
import { compareDispatchItems, isPlayableDispatchItem } from './relevance'
import './Dispatch.css'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
type FeedFilter = 'all' | 'videos' | 'articles'

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`
}

function VideoPlayer({ item, playing, onPlay }: { item: DispatchItem; playing: boolean; onPlay: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const embedUrl = item.embedUrl

  useEffect(() => {
    if (!playing || !item.playbackUrl || !videoRef.current) return

    const video = videoRef.current
    let hls: Hls | null = null
    setMediaError(null)

    const stopPlayback = () => {
      hls?.destroy()
      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    if (isHlsManifestUrl(item.playbackUrl)) {
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true })
        hls.attachMedia(video)
        hls.loadSource(item.playbackUrl)
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setMediaError('This HLS stream could not be loaded.')
        })
      }
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = item.playbackUrl
      }
      else {
        setMediaError('This browser cannot play HLS streams.')
      }
    }
    else {
      video.src = item.playbackUrl
    }

    void video.play().catch(() => {})
    return stopPlayback
  }, [item.playbackUrl, playing])

  if ((!item.playbackUrl && !embedUrl) || !item.thumbnailUrl) return null

  return (
    <div className='video-player'>
      <div className='video-frame'>
        {playing && item.playbackUrl
          ? mediaError
            ? (
                <div className='video-browser-notice'>
                  <strong>Playback unavailable</strong>
                  <span>{mediaError}</span>
                </div>
              )
            : (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  preload='metadata'
                />
              )
          : playing && embedUrl
          ? (
              <iframe
                src={buildYouTubeEmbedUrl(embedUrl, window.location.origin)}
                title={item.title}
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                referrerPolicy='strict-origin-when-cross-origin'
                allowFullScreen
              />
            )
          : (
              <button type='button' className='video-poster' onClick={onPlay} aria-label={`Play ${item.title}`}>
                <img src={item.thumbnailUrl} alt='' loading='lazy' />
                <span className='play-control' aria-hidden='true' />
              </button>
            )}
      </div>
        {playing && (
          <a
            className='video-fallback'
            href={item.playbackUrl ?? item.url}
            target='_blank'
            rel='noreferrer'
          >
            Open stream in new tab
          </a>
        )}
    </div>
  )
}

function App() {
  const [sources, setSources] = useState<SourceResponse | null>(null)
  const [feed, setFeed] = useState<FeedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playingItemId, setPlayingItemId] = useState<string | null>(null)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const [sourcesResponse, feedResponse] = await Promise.all([
          fetch(apiUrl('/api/sources')),
          fetch(apiUrl('/api/feed?limit=100')),
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
      const response = await fetch(apiUrl(`/api/feed?cursor=${encodeURIComponent(feed.nextCursor)}`))
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

  const rankedFeedItems = useMemo(() => {
    if (!feed) return []
    return [...feed.items]
      .filter((item) => {
        if (feedFilter === 'videos') return isPlayableDispatchItem(item)
        if (feedFilter === 'articles') return !isPlayableDispatchItem(item)
        return true
      })
      .sort(compareDispatchItems)
  }, [feed, feedFilter])

  return (
    <main className='dispatch-shell'>
      <header className='dispatch-header'>
        <div className='masthead-rule'>
          <span>The InkEngine War Correspondence</span>
          <span>Established MMXXVI</span>
        </div>
        <div className='masthead-body'>
          <div>
            <p className='eyebrow'>Dispatches from the digital front</p>
            <h1>Dispatch.<wbr />InkEngine.<wbr />Live</h1>
            <p className='subtitle'>Reports, moving pictures, and community intelligence from the War of Rights.</p>
          </div>
          <div className='pulse-chip'>
            <span className={loading ? 'dot pending' : error ? 'dot down' : 'dot live'} />
            <div>
              <strong>{error ? 'Line Interrupted' : 'Wire Service Active'}</strong>
              <small>{feed ? `Updated ${new Date(feed.generatedAt).toLocaleTimeString()}` : 'Awaiting first dispatch'}</small>
              {feed && <small className='storage-label'>{feed.storage} archive</small>}
            </div>
          </div>
        </div>
        <div className='dispatch-dateline'>
          <span>Published continuously</span>
          <span>War of Rights Community Intelligence</span>
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
          <p className='section-kicker'>Signal Office</p>
          <h2>Source Readiness</h2>
          <p className='panel-copy'>Condition of every correspondence line feeding the dispatch desk.</p>
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
          <p className='section-kicker'>Latest Intelligence</p>
          <h2>Dispatch Feed</h2>
          <p className='panel-copy'>Newest reports from connected sources, filed by publication time.</p>
          <div className='feed-filters' role='tablist' aria-label='Choose dispatch content type'>
            {(['all', 'videos', 'articles'] as const).map((filter) => (
              <button
                key={filter}
                type='button'
                role='tab'
                aria-selected={feedFilter === filter}
                className={feedFilter === filter ? 'active' : undefined}
                onClick={() => {
                  setFeedFilter(filter)
                  setPlayingItemId(null)
                }}
              >
                {filter === 'all' ? 'All dispatches' : filter === 'videos' ? 'Watch videos' : 'Read articles'}
              </button>
            ))}
          </div>
          <ul className='feed-list'>
            {rankedFeedItems.map((item) => (
              <li key={item.id} className='feed-item'>
                <div className='feed-head'>
                  <span className='source-tag'>{item.sourceId}</span>
                  <time>{new Date(item.publishedAt).toLocaleString()}</time>
                </div>
                <VideoPlayer item={item} playing={playingItemId === item.id} onPlay={() => setPlayingItemId(item.id)} />
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <a href={item.url} target='_blank' rel='noreferrer'>Read original dispatch</a>
              </li>
            ))}
            {feed?.items.length === 0 && <li className='feed-item'>No feed items yet.</li>}
            {feed && feed.items.length > 0 && rankedFeedItems.length === 0 && (
              <li className='feed-item'>No {feedFilter} are available yet.</li>
            )}
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
