import { describe, expect, it } from 'vitest'
import { formatChangeAbs, formatCompact, formatDataAge, formatLevel, formatNumber, formatPrice } from './format'

describe('formatCompact', () => {
  it('abbreviates large counts without a currency symbol', () => {
    expect(formatCompact(1_234_000_000)).toBe('1.23B')
    expect(formatCompact(4_500_000)).toBe('4.50M')
    expect(formatCompact(12_345)).toBe('12.3K')
    expect(formatCompact(87)).toBe('87')
  })

  it('returns a dash for missing values', () => {
    expect(formatCompact(null)).toBe('—')
    expect(formatCompact(NaN)).toBe('—')
  })
})

describe('formatLevel', () => {
  it('follows the price magnitude', () => {
    expect(formatLevel(65432.123, 65000)).toBe('65,432.12')
    expect(formatLevel(45.6789, 50)).toBe('45.679')
    expect(formatLevel(1.5289, 1.5)).toBe('1.5289')
    expect(formatLevel(0.09939, 0.1)).toBe('0.09939')
  })

  it('uses forex precision for currency pairs', () => {
    expect(formatLevel(1.146384, 1.14, 'FX:EURUSD')).toBe('1.14638')
    expect(formatLevel(157.4, 157, 'FX:USDJPY')).toBe('157.400')
  })

  it('returns a dash for missing values', () => {
    expect(formatLevel(NaN, 100)).toBe('—')
  })
})

describe('formatPrice', () => {
  it('returns a dash for missing values', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined, 'BTC')).toBe('—')
    expect(formatPrice(NaN, 'BTC')).toBe('—')
  })

  it('groups thousands and keeps two decimals', () => {
    expect(formatPrice(65432.1, 'BTC')).toBe('65,432.10')
    expect(formatPrice(999.5, 'AAPL')).toBe('999.50')
  })

  it('keeps four decimals for sub-dollar assets', () => {
    expect(formatPrice(0.0987, 'DOGE', { currency: true })).toBe('$0.0987')
    expect(formatPrice(0.5, 'ADA')).toBe('0.5000')
  })

  it('adds the currency symbol only when asked', () => {
    expect(formatPrice(65432.1, 'BTC', { currency: true })).toBe('$65,432.10')
    expect(formatPrice(12.5, 'AAPL', { currency: true })).toBe('$12.50')
  })

  it('uses forex precision and never a currency symbol for pairs', () => {
    expect(formatPrice(1.08512, 'EURUSD')).toBe('1.08512')
    expect(formatPrice(1.08512, 'FX:EURUSD', { currency: true, forexDecimals: 4 })).toBe('1.0851')
    expect(formatPrice(151.4567, 'USDJPY', { currency: true })).toBe('151.457')
  })
})

describe('formatNumber', () => {
  it('returns a dash for missing values', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(NaN)).toBe('—')
  })

  it('abbreviates billions and millions', () => {
    expect(formatNumber(2_500_000_000)).toBe('$2.50B')
    expect(formatNumber(2_500_000_000, 0, 1)).toBe('$2.5B')
    expect(formatNumber(3_400_000)).toBe('$3.40M')
  })

  it('formats smaller values with fixed decimals and grouping', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50')
    expect(formatNumber(5, 0)).toBe('5')
  })
})

describe('formatChangeAbs', () => {
  it('follows the precision of the price instead of a fixed 2 decimals', () => {
    expect(formatChangeAbs(1.234, 230.45, 'AAPL')).toBe('1.23')
    expect(formatChangeAbs(0.5, 65_000, 'BTC')).toBe('0.50')
    expect(formatChangeAbs(0.0012, 0.0987, 'DOGE')).toBe('0.0012')
    expect(formatChangeAbs(1234.5, 65_000, 'BTC')).toBe('1,234.50')
  })

  it('keeps the quotation of forex pairs', () => {
    expect(formatChangeAbs(0.00123, 1.08512, 'FX:EURUSD')).toBe('0.00123')
    expect(formatChangeAbs(0.45, 151.4, 'FX:USDJPY')).toBe('0.450')
  })

  it('returns the magnitude and a dash for missing values', () => {
    expect(formatChangeAbs(-1.234, 230.45, 'AAPL')).toBe('1.23')
    expect(formatChangeAbs(null, 230.45, 'AAPL')).toBe('—')
    expect(formatChangeAbs(undefined, 230.45, 'AAPL')).toBe('—')
    expect(formatChangeAbs(NaN, 230.45, 'AAPL')).toBe('—')
  })
})

describe('formatDataAge', () => {
  it('says "now" while the datum is a few seconds old', () => {
    expect(formatDataAge(0, 'es')).toBe('ahora')
    expect(formatDataAge(4_999, 'es')).toBe('ahora')
    expect(formatDataAge(0, 'en')).toBe('now')
  })

  it('counts seconds under a minute, then minutes, then hours', () => {
    expect(formatDataAge(5_000, 'es')).toBe('hace 5 s')
    expect(formatDataAge(30_000, 'es')).toBe('hace 30 s')
    expect(formatDataAge(59_999, 'es')).toBe('hace 59 s')
    expect(formatDataAge(90_000, 'es')).toBe('hace 1 min')
    expect(formatDataAge(59 * 60_000, 'es')).toBe('hace 59 min')
    expect(formatDataAge(3_600_000, 'es')).toBe('hace 1 h')
    expect(formatDataAge(2 * 3_600_000, 'es')).toBe('hace 2 h')
  })

  it('translates the same thresholds to english', () => {
    expect(formatDataAge(30_000, 'en')).toBe('30 s ago')
    expect(formatDataAge(90_000, 'en')).toBe('1 min ago')
    expect(formatDataAge(2 * 3_600_000, 'en')).toBe('2 h ago')
  })

  it('clamps negative and unusable ages to "now"', () => {
    expect(formatDataAge(-1_000, 'es')).toBe('ahora')
    expect(formatDataAge(NaN, 'es')).toBe('ahora')
    expect(formatDataAge(undefined as unknown as number, 'es')).toBe('ahora')
  })

  it('defaults to spanish', () => {
    expect(formatDataAge(30_000)).toBe('hace 30 s')
  })
})
