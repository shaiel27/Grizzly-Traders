import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }))

import { buildTickerQuotes } from './ticker'
import type { PriceData } from './prices'

const row = (s: string, close: number, change: number) => ({ s, d: [close, change] })

const price = (symbol: string, value: number, percent = 0): PriceData => ({
  symbol,
  price: value,
  change24h: 0,
  changePercent24h: percent,
  source: 'test',
  timestamp: 0,
})

describe('buildTickerQuotes', () => {
  it('uses live scanner quotes with their daily change', () => {
    const quotes = buildTickerQuotes([row('BINANCE:BTCUSDT', 65_000, 2.5)], [])
    expect(quotes).toEqual([{ symbol: 'BTC', label: 'BTC/USD', price: 65_000, changePercent: 2.5, currency: true }])
  })

  it('prefers the scanner over the price providers', () => {
    const quotes = buildTickerQuotes([row('FX:EURUSD', 1.09, 0.1)], [price('EURUSD', 1.05, -1)])
    expect(quotes).toHaveLength(1)
    expect(quotes[0]).toMatchObject({ price: 1.09, changePercent: 0.1, currency: false })
  })

  it('falls back to the price providers for assets the scanner did not return', () => {
    const quotes = buildTickerQuotes([], [price('ETH', 3_200, 1.2)])
    expect(quotes).toEqual([{ symbol: 'ETH', label: 'ETH/USD', price: 3_200, changePercent: 1.2, currency: true }])
  })

  it('ignores invalid quotes on both sources', () => {
    const quotes = buildTickerQuotes([row('BINANCE:BTCUSDT', 0, 1), row('BINANCE:SOLUSDT', NaN, 1)], [price('BTC', 0)])
    expect(quotes).toEqual([])
  })

  it('keeps a quote without daily change instead of dropping it', () => {
    const quotes = buildTickerQuotes([{ s: 'TVC:VIX', d: [14.8, null] }], [])
    expect(quotes[0]).toMatchObject({ symbol: 'VIX', price: 14.8, changePercent: null })
  })

  it('keeps the curated order and mixes asset classes at the start', () => {
    const rows = [
      row('SP:SPX', 5_000, 0.3),
      row('BINANCE:BTCUSDT', 65_000, 1),
      row('OANDA:XAUUSD', 2_400, -0.4),
      row('FX:EURUSD', 1.09, 0.1),
    ]
    expect(buildTickerQuotes(rows, []).map((quote) => quote.symbol)).toEqual(['BTC', 'EURUSD', 'SPX', 'XAUUSD'])
  })
})
