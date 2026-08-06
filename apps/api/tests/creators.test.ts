import { describe, expect, it } from 'vitest'
import { creatorProfileSchema } from '@inkengine/contracts'
import { getFeaturedCreators } from '../src/creators.js'

describe('featured creators', () => {
  it('returns a list of schema-valid creator profiles', () => {
    const creators = getFeaturedCreators()
    expect(Array.isArray(creators)).toBe(true)
    for (const creator of creators) {
      expect(() => creatorProfileSchema.parse(creator)).not.toThrow()
    }
  })
})
