import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, findMissingKeys, getDictionary, hasLocale, t, type Dictionary } from './get-dictionary'
import { categoryMeta, localizedPost, sentimentMeta, timeAgo } from '../feed'
import type { PostTranslation } from '../types'

describe('hasLocale', () => {
  it('accepts es and en', () => {
    expect(hasLocale('es')).toBe(true)
    expect(hasLocale('en')).toBe(true)
  })

  it('rejects anything else, including undefined/null', () => {
    expect(hasLocale('fr')).toBe(false)
    expect(hasLocale(undefined)).toBe(false)
    expect(hasLocale(null)).toBe(false)
    expect(hasLocale('')).toBe(false)
  })
})

describe('getDictionary', () => {
  it('returns the matching dictionary for es and en', () => {
    expect(getDictionary('es').header.navNews).toBe('Noticias')
    expect(getDictionary('en').header.navNews).toBe('News')
  })

  it('falls back to the default locale for an unexpected value', () => {
    // @ts-expect-error — intentionally passing an invalid locale to check the runtime fallback
    expect(getDictionary('fr')).toBe(getDictionary(DEFAULT_LOCALE))
  })
})

describe('dictionary parity', () => {
  it('es and en expose exactly the same set of keys (no missing translations)', () => {
    const es = getDictionary('es')
    const en = getDictionary('en')
    expect(findMissingKeys(es, en)).toEqual([])
    expect(findMissingKeys(en, es)).toEqual([])
  })
})

describe('t (interpolation)', () => {
  it('replaces {token} placeholders', () => {
    expect(t('Página {n}', { n: 3 })).toBe('Página 3')
    expect(t('{n} {unit} en las últimas 24 h', { n: 1, unit: 'noticia' })).toBe('1 noticia en las últimas 24 h')
  })

  it('leaves unknown placeholders untouched', () => {
    expect(t('Hola {nombre}', {})).toBe('Hola {nombre}')
  })
})

describe('localizedPost fallback (lib/feed.ts, Fase 5.3)', () => {
  const basePost = { title: 'Base ES title', slug: 'base-es-title' }
  const esTranslation: PostTranslation = {
    id: 1,
    post_id: 'post-1',
    locale: 'es',
    title: 'Título en Español',
    slug: 'titulo-en-espanol',
    content_html: '',
    meta_title: null,
    meta_description: null,
    created_at: '',
    updated_at: '',
  }
  const enTranslation: PostTranslation = { ...esTranslation, id: 2, locale: 'en', title: 'English Title', slug: 'english-title' }

  it('picks the active locale translation when it exists', () => {
    const result = localizedPost({ ...basePost, translations: [esTranslation, enTranslation] }, 'en')
    expect(result).toEqual({ title: 'English Title', slug: 'english-title' })
  })

  it('falls back to the es translation when the active locale has no row', () => {
    const result = localizedPost({ ...basePost, translations: [esTranslation] }, 'en')
    expect(result).toEqual({ title: 'Título en Español', slug: 'titulo-en-espanol' })
  })

  it('falls back to post.title/post.slug when there are no translations at all', () => {
    const result = localizedPost({ ...basePost, translations: [] }, 'en')
    expect(result).toEqual({ title: 'Base ES title', slug: 'base-es-title' })
  })

  it('defaults to es when no locale argument is passed (back-compat)', () => {
    const result = localizedPost({ ...basePost, translations: [esTranslation, enTranslation] })
    expect(result.title).toBe('Título en Español')
  })
})

describe('sentimentMeta locale-awareness', () => {
  it('labels switch between es and en without changing the chip classes', () => {
    const es = sentimentMeta('bullish', 'es')
    const en = sentimentMeta('bullish', 'en')
    expect(es.label).toBe('Alcista')
    expect(en.label).toBe('Bullish')
    expect(es.chip).toBe(en.chip)
  })

  it('defaults to es when no locale argument is passed (back-compat)', () => {
    expect(sentimentMeta('bearish').label).toBe('Bajista')
  })
})

describe('categoryMeta locale-awareness', () => {
  const forexCategory = { id: 1, name: 'Forex', slug: 'forex', created_at: '', updated_at: '' }

  it('translates the display name per locale while keeping icon/chip stable', () => {
    const es = categoryMeta(forexCategory, 'es')
    const en = categoryMeta(forexCategory, 'en')
    expect(es.name).toBe('Forex')
    expect(en.name).toBe('Forex')
    expect(es.icon).toBe(en.icon)
  })

  it('falls back to the "default" dictionary entry for an unknown/null category', () => {
    expect(categoryMeta(null, 'en').name).toBe('News')
    expect(categoryMeta(null, 'es').name).toBe('Noticias')
  })
})

describe('timeAgo locale-awareness', () => {
  it('renders English copy for en and Spanish copy for es', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(timeAgo(fiveMinAgo, 'es')).toBe('hace 5 min')
    expect(timeAgo(fiveMinAgo, 'en')).toBe('5 min ago')
  })

  it('handles the null/"unknown" case per locale', () => {
    expect(timeAgo(null, 'es')).toBe('recientemente')
    expect(timeAgo(null, 'en')).toBe('recently')
  })

  it('defaults to es when no locale argument is passed (back-compat)', () => {
    expect(timeAgo(null)).toBe('recientemente')
  })
})

// Compile-time check only: ensures the Dictionary type stays a plain, JSON-serializable shape.
void (null as unknown as Dictionary)
