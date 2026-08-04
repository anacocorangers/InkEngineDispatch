import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from './App'

describe('App', () => {
  it('renders the dispatch title', () => {
    const html = renderToString(<App />)
    expect(html).toContain('Dispatch.InkEngine.Live')
  })
})
