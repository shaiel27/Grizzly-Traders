import { describe, expect, it } from 'vitest'
import {
  generateUniqueSlug,
  joinHtmlTextNodes,
  slugify,
  splitHtmlTextNodes,
  translateHtmlNodes,
} from './translate-posts-core.mjs'

describe('slugify', () => {
  it('lowercases, strips accents and collapses non-alphanumeric runs to a dash', () => {
    expect(slugify('Bitcoin Rompe los $70,000: ¿Qué Sigue?')).toBe('bitcoin-rompe-los-70-000-que-sigue')
    expect(slugify('Análisis técnico: EUR/USD y el Banco Central')).toBe('analisis-tecnico-eur-usd-y-el-banco-central')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('  -- Hola! --  ')).toBe('hola')
  })
})

describe('generateUniqueSlug', () => {
  it('returns the base slug untouched when it is free', async () => {
    const slug = await generateUniqueSlug('bitcoin-rally', async () => false)
    expect(slug).toBe('bitcoin-rally')
  })

  it('appends -2, -3, ... until it finds a free slug', async () => {
    const taken = new Set(['bitcoin-rally', 'bitcoin-rally-2', 'bitcoin-rally-3'])
    const slug = await generateUniqueSlug('bitcoin-rally', async (candidate: string) => taken.has(candidate))
    expect(slug).toBe('bitcoin-rally-4')
  })

  it('only ever calls the exists-check with candidates derived from the base slug', async () => {
    const seen: string[] = []
    await generateUniqueSlug('eth', async (candidate: string) => {
      seen.push(candidate)
      return seen.length < 3
    })
    expect(seen).toEqual(['eth', 'eth-2', 'eth-3'])
  })
})

describe('splitHtmlTextNodes / joinHtmlTextNodes', () => {
  it('round-trips arbitrary HTML exactly', () => {
    const html = '<p>Hola <strong>mundo</strong>, el oro sube&nbsp;hoy.</p><ul><li>Uno</li><li>Dos</li></ul>'
    const segments = splitHtmlTextNodes(html)
    expect(joinHtmlTextNodes(segments)).toBe(html)
  })

  it('marks tags and text correctly', () => {
    const segments = splitHtmlTextNodes('<p class="x">Hola</p>')
    expect(segments).toEqual([
      { text: '<p class="x">', isTag: true },
      { text: 'Hola', isTag: false },
      { text: '</p>', isTag: true },
    ])
  })
})

describe('translateHtmlNodes', () => {
  // A mock "translator" that makes the transformation obvious without any network call.
  const shout = async (text: string) => text.toUpperCase()

  it('preserves every tag byte-for-byte while translating only text nodes', async () => {
    const html = '<p>Hola <strong class="x">mundo</strong></p>'
    const result = await translateHtmlNodes(html, shout)
    expect(result).toBe('<p>HOLA <strong class="x">MUNDO</strong></p>')
  })

  it('preserves leading/trailing whitespace around text nodes exactly', async () => {
    const html = '<p>  Hola mundo  </p>'
    const result = await translateHtmlNodes(html, shout)
    expect(result).toBe('<p>  HOLA MUNDO  </p>')
  })

  it('never calls the translator for whitespace-only or empty text nodes', async () => {
    const calls: string[] = []
    const record = async (text: string) => {
      calls.push(text)
      return text
    }
    await translateHtmlNodes('<div>\n  </div><p>Hola</p>', record)
    expect(calls).toEqual(['Hola'])
  })

  it('does not mangle nested markup or self-closing tags', async () => {
    const html = '<p>Precio: <br/><em>alto</em> y <b>bajo</b></p>'
    const result = await translateHtmlNodes(html, shout)
    expect(result).toBe('<p>PRECIO: <br/><em>ALTO</em> Y <b>BAJO</b></p>')
  })
})
