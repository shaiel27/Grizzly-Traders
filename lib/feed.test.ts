import { afterEach, describe, expect, it, vi } from 'vitest'
import { excerpt, localizedAuthor, localizedPost, localizedPostContent, timeAgo } from './feed'
import type { PostTranslation } from './types'

const translation = (locale: 'es' | 'en', title: string, slug: string) =>
  ({ locale, title, slug }) as PostTranslation

const esCard = translation('es', 'ES', 'es-slug')
const enCard = translation('en', 'EN', 'en-slug')

// Modelo A: `posts` guarda el original en su idioma y `posts.original_locale` dice cuál es, así que
// los campos base del post NO son necesariamente españoles. La cascada es:
// locale activo -> `original_locale` del post -> cualquier fila -> campos base del post.
describe('localizedPost', () => {
  const spanishOriginal = { title: 'Título base', slug: 'titulo-base', original_locale: 'es' as const }
  const englishOriginal = { title: 'Base title', slug: 'base-title', original_locale: 'en' as const }

  it('serves the requested locale when its row exists, whatever the original is', () => {
    expect(localizedPost({ ...spanishOriginal, translations: [esCard, enCard] }, 'es')).toEqual({ title: 'ES', slug: 'es-slug' })
    expect(localizedPost({ ...spanishOriginal, translations: [esCard, enCard] }, 'en')).toEqual({ title: 'EN', slug: 'en-slug' })
    expect(localizedPost({ ...englishOriginal, translations: [esCard, enCard] }, 'es')).toEqual({ title: 'ES', slug: 'es-slug' })
    expect(localizedPost({ ...englishOriginal, translations: [esCard, enCard] }, 'en')).toEqual({ title: 'EN', slug: 'en-slug' })
  })

  it('falls back to the row in the post original locale when the requested one is missing', () => {
    expect(localizedPost({ ...spanishOriginal, translations: [esCard] }, 'en')).toEqual({ title: 'ES', slug: 'es-slug' })
    // Original en inglés: un lector en español recibe el inglés, no un hueco.
    expect(localizedPost({ ...englishOriginal, translations: [enCard] }, 'es')).toEqual({ title: 'EN', slug: 'en-slug' })
  })

  it('falls back to the post base fields when there is no translation row at all', () => {
    expect(localizedPost({ ...spanishOriginal, translations: [] }, 'en')).toEqual({
      title: 'Título base',
      slug: 'titulo-base',
    })
    expect(localizedPost({ ...englishOriginal, translations: [] }, 'es')).toEqual({
      title: 'Base title',
      slug: 'base-title',
    })
    expect(localizedPost(englishOriginal, 'en')).toEqual({ title: 'Base title', slug: 'base-title' })
  })

  it('treats a missing original_locale as es (the DB column default)', () => {
    const post = { title: 'Post title', slug: 'post-slug' }
    expect(localizedPost({ ...post, translations: [esCard, enCard] })).toEqual({ title: 'ES', slug: 'es-slug' })
    expect(localizedPost(post)).toEqual(post)
  })
})

// Este es el contrato que decide el aviso de «traducción pendiente» del artículo: isFallback tiene
// que ser true cuando falta la fila del idioma PEDIDO, en cualquiera de las dos direcciones.
describe('localizedPostContent', () => {
  const row = (locale: 'es' | 'en', suffix: string): PostTranslation =>
    ({
      locale,
      title: `Title ${suffix}`,
      slug: `slug-${suffix}`,
      content_html: `<p>${suffix}</p>`,
      meta_title: `Meta ${suffix}`,
      meta_description: `Desc ${suffix}`,
    }) as PostTranslation

  const esRow = row('es', 'es')
  const enRow = row('en', 'en')
  const spanishOriginal = {
    title: 'Título base',
    slug: 'titulo-base',
    content_html: '<p>Base ES</p>',
    meta_title: null,
    meta_description: null,
    original_locale: 'es' as const,
  }
  const englishOriginal = {
    ...spanishOriginal,
    title: 'Base title',
    content_html: '<p>Base EN</p>',
    original_locale: 'en' as const,
  }

  it('reports no fallback when the requested locale has its own row', () => {
    expect(localizedPostContent({ ...spanishOriginal, translations: [esRow, enRow] }, 'en')).toMatchObject({
      title: 'Title en',
      contentHtml: '<p>en</p>',
      metaTitle: 'Meta en',
      metaDescription: 'Desc en',
      resolvedLocale: 'en',
      originalLocale: 'es',
      isFallback: false,
    })
    expect(localizedPostContent({ ...englishOriginal, translations: [esRow, enRow] }, 'es')).toMatchObject({
      resolvedLocale: 'es',
      originalLocale: 'en',
      isFallback: false,
    })
  })

  it('flags a fallback when the requested row is missing — es original read in en', () => {
    expect(localizedPostContent({ ...spanishOriginal, translations: [esRow] }, 'en')).toMatchObject({
      title: 'Title es',
      contentHtml: '<p>es</p>',
      resolvedLocale: 'es',
      originalLocale: 'es',
      isFallback: true,
    })
  })

  // El defecto que el Modelo A destapa: con la cascada vieja el segundo escalón era «español» por
  // definición, así que un original en inglés se servía a un lector en español SIN aviso.
  it('flags a fallback when the requested row is missing — en original read in es', () => {
    expect(localizedPostContent({ ...englishOriginal, translations: [enRow] }, 'es')).toMatchObject({
      title: 'Title en',
      contentHtml: '<p>en</p>',
      resolvedLocale: 'en',
      originalLocale: 'en',
      isFallback: true,
    })
  })

  it('falls back to the base fields with no row at all, and only flags it if another language was asked for', () => {
    // Sin filas, los campos base están en original_locale: pedir ese mismo idioma NO es un fallback.
    expect(localizedPostContent({ ...englishOriginal, translations: [] }, 'en')).toMatchObject({
      title: 'Base title',
      contentHtml: '<p>Base EN</p>',
      metaTitle: null,
      metaDescription: null,
      resolvedLocale: 'en',
      isFallback: false,
    })
    expect(localizedPostContent({ ...spanishOriginal, translations: [] }, 'es')).toMatchObject({
      resolvedLocale: 'es',
      isFallback: false,
    })
    // Pedir el otro idioma sí lo es, en las dos direcciones.
    expect(localizedPostContent({ ...englishOriginal, translations: [] }, 'es')).toMatchObject({
      resolvedLocale: 'en',
      isFallback: true,
    })
    expect(localizedPostContent({ ...spanishOriginal, translations: [] }, 'en')).toMatchObject({
      resolvedLocale: 'es',
      isFallback: true,
    })
  })

  it('treats a missing original_locale as es (the DB column default)', () => {
    // Una fila (o un mock) sin la columna: la cascada tiene que comportarse como un original en es.
    const withoutColumn = {
      title: 'Título base',
      slug: 'titulo-base',
      content_html: '<p>Base ES</p>',
      meta_title: null,
      meta_description: null,
    }
    expect(localizedPostContent({ ...withoutColumn, translations: [] }, 'es')).toMatchObject({
      resolvedLocale: 'es',
      originalLocale: 'es',
      isFallback: false,
    })
    expect(localizedPostContent({ ...withoutColumn, translations: [] }, 'en')).toMatchObject({ isFallback: true })
  })
})

describe('excerpt', () => {
  it('strips tags and collapses whitespace', () => {
    expect(excerpt('<p>Hello&nbsp;<strong>world</strong></p>\n<p>again</p>')).toBe('Hello world again')
  })

  it('cuts long text at a word boundary and adds an ellipsis', () => {
    const result = excerpt('alpha beta gamma delta epsilon', 14)
    expect(result).toBe('alpha beta…')
  })
})

describe('timeAgo', () => {
  afterEach(() => vi.useRealTimers())

  it('describes elapsed time in Spanish', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'))
    expect(timeAgo(null)).toBe('recientemente')
    expect(timeAgo('2026-01-10T11:59:50Z')).toBe('hace 1 min')
    expect(timeAgo('2026-01-10T11:30:00Z')).toBe('hace 30 min')
    expect(timeAgo('2026-01-10T09:00:00Z')).toBe('hace 3 h')
    expect(timeAgo('2026-01-09T12:00:00Z')).toBe('hace 1 día')
    expect(timeAgo('2026-01-05T12:00:00Z')).toBe('hace 5 días')
  })
})

describe('localizedAuthor', () => {
  const autor = { bio: 'Bio ES', role: 'Fundador', bio_en: 'Bio EN', role_en: 'Founder' }

  it('devuelve el texto en inglés cuando el idioma es en', () => {
    expect(localizedAuthor(autor, 'en')).toEqual({ bio: 'Bio EN', role: 'Founder' })
  })

  it('devuelve el texto base en español cuando el idioma es es', () => {
    expect(localizedAuthor(autor, 'es')).toEqual({ bio: 'Bio ES', role: 'Fundador' })
  })

  it('cae al español si no hay traducción', () => {
    expect(localizedAuthor({ bio: 'Bio ES', role: 'Fundador' }, 'en')).toEqual({ bio: 'Bio ES', role: 'Fundador' })
    expect(localizedAuthor({ bio: 'Bio ES', role: null, bio_en: '', role_en: null }, 'en')).toEqual({ bio: 'Bio ES', role: null })
  })
})
