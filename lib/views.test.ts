import { beforeEach, describe, expect, it } from 'vitest'
import { isBot, resetViewDedupe, shouldCountView } from './views'

describe('isBot', () => {
  it('reconoce rastreadores y agentes vacíos', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBot('facebookexternalhit/1.1')).toBe(true)
    expect(isBot('HeadlessChrome/120')).toBe(true)
    expect(isBot('')).toBe(true)
    expect(isBot(null)).toBe(true)
  })
  it('deja pasar un navegador normal', () => {
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile Safari/604.1')).toBe(false)
  })
})

describe('shouldCountView', () => {
  beforeEach(() => resetViewDedupe())
  const t0 = 1_000_000

  it('cuenta una vez por IP y artículo en 30 minutos', () => {
    expect(shouldCountView('1.1.1.1', 'a', t0)).toBe(true)
    expect(shouldCountView('1.1.1.1', 'a', t0 + 60_000)).toBe(false)
    expect(shouldCountView('1.1.1.1', 'a', t0 + 31 * 60_000)).toBe(true)
  })
  it('otra IP u otro artículo cuentan por separado', () => {
    expect(shouldCountView('1.1.1.1', 'a', t0)).toBe(true)
    expect(shouldCountView('2.2.2.2', 'a', t0)).toBe(true)
    expect(shouldCountView('1.1.1.1', 'b', t0)).toBe(true)
  })
})
