import { describe, expect, it } from 'vitest'
import { evaluarCertificado, evaluarFrescura, primerArticulo, ultimaPublicacion } from './uptime-check.mjs'

const AHORA = Date.parse('2026-11-06T15:00:00Z')
const feed = (...fechas: string[]) =>
  `<rss><channel><title>x</title>${fechas.map((f, i) => `<item><title>n${i}</title><link>https://grizzlytraders.com/articulos/n${i}</link><pubDate>${f}</pubDate></item>`).join('')}</channel></rss>`

describe('feed: frescura', () => {
  it('toma la fecha más reciente aunque no vengan ordenadas', () => {
    expect(ultimaPublicacion(feed('Fri, 06 Nov 2026 10:00:00 GMT', 'Fri, 06 Nov 2026 14:33:22 GMT', 'Thu, 05 Nov 2026 09:00:00 GMT'))).toBe(Date.parse('2026-11-06T14:33:22Z'))
  })

  it('con una nota reciente está bien', () => {
    const r = evaluarFrescura(feed('Fri, 06 Nov 2026 14:33:22 GMT'), AHORA)
    expect(r.ok).toBe(true)
    expect(r.detalle).toContain('0.4 h')
  })

  it('si no hay notas nuevas desde hace más del máximo, avisa de que el pipeline puede estar parado', () => {
    const r = evaluarFrescura(feed('Fri, 06 Nov 2026 09:00:00 GMT'), AHORA)
    expect(r.ok).toBe(false)
    expect(r.detalle).toMatch(/pipeline puede estar parado/)
    expect(evaluarFrescura(feed('Fri, 06 Nov 2026 09:00:00 GMT'), AHORA, 8).ok).toBe(true)
  })

  it('un feed vacío o sin fechas falla', () => {
    expect(evaluarFrescura('<rss><channel></channel></rss>', AHORA).ok).toBe(false)
    expect(evaluarFrescura('', AHORA).ok).toBe(false)
  })
})

describe('feed: primer artículo', () => {
  it('devuelve el enlace del primer item', () => {
    expect(primerArticulo(feed('Fri, 06 Nov 2026 14:33:22 GMT', 'Fri, 06 Nov 2026 10:00:00 GMT'))).toBe('https://grizzlytraders.com/articulos/n0')
    expect(primerArticulo('<rss></rss>')).toBeNull()
  })
})

describe('certificado TLS', () => {
  it('queda bien con margen y falla cuando caduca pronto o la fecha es ilegible', () => {
    expect(evaluarCertificado('Feb  4 12:00:00 2027 GMT', AHORA).ok).toBe(true)
    const pronto = evaluarCertificado('Nov 10 12:00:00 2026 GMT', AHORA)
    expect(pronto.ok).toBe(false)
    expect(pronto.detalle).toContain('caduca en 3 días')
    expect(evaluarCertificado('no es una fecha', AHORA).ok).toBe(false)
  })
})
