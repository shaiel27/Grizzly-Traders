import { describe, expect, it } from 'vitest'
import { formatNumber, formatPrice } from './format'

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
