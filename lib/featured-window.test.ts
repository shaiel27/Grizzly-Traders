import { describe, expect, it } from 'vitest'
import { FEATURED_WINDOW_MS, featuredHoursLeft, isInFeaturedWindow, pickFeaturedPost } from './featured-window'

const NOW = Date.parse('2026-11-14T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const H = 60 * 60 * 1000

describe('isInFeaturedWindow', () => {
  it('es true un segundo antes de cumplir 24 h', () => {
    expect(isInFeaturedWindow(ago(FEATURED_WINDOW_MS - 1000), NOW)).toBe(true)
  })
  it('es false justo a las 24 h (el limite es exclusivo)', () => {
    expect(isInFeaturedWindow(ago(FEATURED_WINDOW_MS), NOW)).toBe(false)
  })
  it('es false un segundo despues de las 24 h', () => {
    expect(isInFeaturedWindow(ago(FEATURED_WINDOW_MS + 1000), NOW)).toBe(false)
  })
  it('es true para un articulo recien publicado', () => {
    expect(isInFeaturedWindow(ago(0), NOW)).toBe(true)
  })
  it('es false con fecha futura (no se destaca algo aun no publicado)', () => {
    expect(isInFeaturedWindow(ago(-60 * 1000), NOW)).toBe(false)
  })
  it.each([null, undefined, '', 'no es una fecha', '2026-13-45'])('es false con fecha invalida (%s)', (v) => {
    expect(isInFeaturedWindow(v as string | null | undefined, NOW)).toBe(false)
  })
})

describe('featuredHoursLeft', () => {
  it('redondea hacia arriba las horas que quedan', () => {
    expect(featuredHoursLeft(ago(14 * H), NOW)).toBe(10)
    expect(featuredHoursLeft(ago(14 * H + 60 * 1000), NOW)).toBe(10)
  })
  it('devuelve 0 si ya no esta en la ventana o la fecha es invalida', () => {
    expect(featuredHoursLeft(ago(25 * H), NOW)).toBe(0)
    expect(featuredHoursLeft('x', NOW)).toBe(0)
  })
})

describe('pickFeaturedPost', () => {
  const post = (id: string, published_at: string | null) => ({ id, published_at })

  it('devuelve undefined sin articulos', () => {
    expect(pickFeaturedPost([], NOW)).toBeUndefined()
  })
  it('elige el mas reciente dentro de las 24 h aunque la lista venga desordenada', () => {
    const posts = [post('a', ago(10 * H)), post('b', ago(2 * H)), post('c', ago(30 * H))]
    expect(pickFeaturedPost(posts, NOW)?.id).toBe('b')
  })
  it('devuelve undefined si todos pasaron de 24 h', () => {
    expect(pickFeaturedPost([post('a', ago(25 * H)), post('b', ago(48 * H))], NOW)).toBeUndefined()
  })
  it('ignora fechas invalidas y futuras', () => {
    const posts = [post('futuro', ago(-5 * H)), post('malo', 'xx'), post('nulo', null), post('ok', ago(5 * H))]
    expect(pickFeaturedPost(posts, NOW)?.id).toBe('ok')
  })
  it('no destaca nada si solo hay fechas invalidas o futuras', () => {
    expect(pickFeaturedPost([post('futuro', ago(-H)), post('malo', 'xx')], NOW)).toBeUndefined()
  })
  it('no muta la lista recibida', () => {
    const posts = [post('a', ago(10 * H)), post('b', ago(2 * H))]
    pickFeaturedPost(posts, NOW)
    expect(posts.map((p) => p.id)).toEqual(['a', 'b'])
  })
})
