import { describe, expect, it } from 'vitest'
import { isPublicPagePath, localePrefixOf, resolveRewrite, stripLocalePrefix } from './rewrite'

describe('isPublicPagePath', () => {
  it('reconoce las páginas del sitio', () => {
    for (const path of ['/', '/articulos', '/articulos/un-slug', '/autor/moises-orraiz', '/legal/privacidad', '/markets']) {
      expect(isPublicPagePath(path)).toBe(true)
    }
  })
  it('deja fuera API, panel, acceso, internos y archivos', () => {
    for (const path of ['/api/posts', '/api', '/_next/static/x.js', '/cms', '/cms/editar', '/login', '/auth/callback', '/feed.xml', '/sitemap.xml', '/robots.txt', '/logo.png', '/globo/tierra.png', '/fonts/a.woff2']) {
      expect(isPublicPagePath(path)).toBe(false)
    }
  })
  it('no confunde un slug que empieza como un prefijo excluido', () => {
    expect(isPublicPagePath('/apitest')).toBe(true)
    expect(isPublicPagePath('/cmsx/y')).toBe(true)
  })
})

describe('resolveRewrite', () => {
  it('reescribe según la cookie, español por defecto', () => {
    expect(resolveRewrite('/', undefined)).toEqual({ type: 'rewrite', to: '/es', locale: 'es' })
    expect(resolveRewrite('/articulos/x', 'en')).toEqual({ type: 'rewrite', to: '/en/articulos/x', locale: 'en' })
    expect(resolveRewrite('/articulos', 'fr')).toEqual({ type: 'rewrite', to: '/es/articulos', locale: 'es' })
  })
  it('no toca lo que no es una página pública', () => {
    expect(resolveRewrite('/api/x', 'en')).toEqual({ type: 'none' })
    expect(resolveRewrite('/cms', 'en')).toEqual({ type: 'none' })
    expect(resolveRewrite('/feed.xml', 'en')).toEqual({ type: 'none' })
  })
  it('un prefijo de idioma redirige a la URL canónica sin prefijo', () => {
    expect(resolveRewrite('/en/articulos', 'es')).toEqual({ type: 'redirect', to: '/articulos', locale: 'en' })
    expect(resolveRewrite('/es', 'en')).toEqual({ type: 'redirect', to: '/', locale: 'es' })
  })
})

describe('localePrefixOf / stripLocalePrefix', () => {
  it('detecta y quita solo el prefijo exacto', () => {
    expect(localePrefixOf('/en/markets')).toBe('en')
    expect(localePrefixOf('/english')).toBeNull()
    expect(stripLocalePrefix('/en/markets')).toBe('/markets')
    expect(stripLocalePrefix('/es')).toBe('/')
    expect(stripLocalePrefix('/markets')).toBe('/markets')
  })
})
