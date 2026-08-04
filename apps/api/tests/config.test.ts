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
})