import { describe, expect, it } from 'vitest'
import { GLOSSARY } from './glossary'

describe('GLOSSARY', () => {
  it('has at least one term', () => {
    expect(GLOSSARY.length).toBeGreaterThan(0)
  })

  it('has unique slugs', () => {
    const slugs = GLOSSARY.map((entry) => entry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it.each(GLOSSARY.map((entry) => [entry.slug, entry] as const))(
    '%s has non-empty term, termEn, definition and definitionEn',
    (_slug, entry) => {
      expect(entry.term.length).toBeGreaterThan(0)
      expect(entry.termEn.length).toBeGreaterThan(0)
      expect(entry.definition.length).toBeGreaterThan(0)
      expect(entry.definitionEn.length).toBeGreaterThan(0)
    },
  )
})
