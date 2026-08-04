import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from './App'
import { buildYouTubeEmbedUrl } from './youtube'

describe('App', () => {
  it('renders the dispatch title', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Dispatch.<wbr/>InkEngine.<wbr/>Live')
  })

  it('builds a YouTube embed URL with the hosting origin', () => {
    const url = new URL(buildYouTubeEmbedUrl(
      'https://www.youtube-nocookie.com/embed/DgUNMYK8WMs',
      'https://dispatch.inkengine.live',
    ))

    expect(url.origin).toBe('https://www.youtube.com')
    expect(url.pathname).toBe('/embed/DgUNMYK8WMs')
    expect(url.searchParams.get('autoplay')).toBe('1')
    expect(url.searchParams.get('playsinline')).toBe('1')
    expect(url.searchParams.get('origin')).toBe('https://dispatch.inkengine.live')
  })
})
