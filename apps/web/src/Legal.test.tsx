import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PrivacyPage, TermsPage } from './Legal'

describe('legal pages', () => {
  it('renders Discord-specific terms', () => {
    const html = renderToString(<TermsPage />)
    expect(html).toContain('Terms of Service')
    expect(html).toContain('reads messages only from channels explicitly selected')
  })

  it('describes source data processing and user choices', () => {
    const html = renderToString(<PrivacyPage />)
    expect(html).toContain('Privacy Policy')
    expect(html).toContain('does not sell personal information')
    expect(html).toContain('revoke the bot&#x27;s access')
  })
})