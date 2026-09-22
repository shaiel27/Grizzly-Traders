import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }))

import { isPivotTimeframe, mapPivotRows, pivotColumns } from './pivot-data'

const row = (s: string, d: unknown[]) => ({ s, d })

describe('pivotColumns', () => {
  it('asks for the previous bar of the requested timeframe', () => {
    expect(pivotColumns('D')).toContain('high[1]')
    expect(pivotColumns('W')).toEqual(expect.arrayContaining(['high[1]|1W', 'low[1]|1W', 'close[1]|1W', 'open[1]|1W']))
    expect(pivotColumns('M')).toContain('close[1]|1M')
  })

  it('never requests the scanner monthly pivot columns', () => {
    expect(pivotColumns('D').some((column) => column.startsWith('Pivot.'))).toBe(false)
  })
})

describe('isPivotTimeframe', () => {
  it('accepts only the supported periods', () => {
    expect(['D', 'W', 'M'].every(isPivotTimeframe)).toBe(true)
    expect(isPivotTimeframe('H')).toBe(false)
    expect(isPivotTimeframe('d')).toBe(false)
  })
})

describe('mapPivotRows', () => {
  const btc = row('BINANCE:BTCUSDT', ['BTCUSDT', 'Bitcoin', 86_000, 2.5, 2_100, 84_000, 88_000, 83_000, 85_000])

  it('maps a scanner row to a quote keyed by the TradingView ticker', () => {
    expect(mapPivotRows([btc])).toEqual([
      {
        symbol: 'BINANCE:BTCUSDT',
        ticker: 'BTCUSDT',
        description: 'Bitcoin',
        price: 86_000,
        change: 2.5,
        changeAbs: 2_100,
        previous: { open: 84_000, high: 88_000, low: 83_000, close: 85_000 },
      },
    ])
  })

  it('follows the catalog order, not the scanner order', () => {
    const eur = row('FX:EURUSD', ['EURUSD', 'EUR/USD', 1.14, 0.1, 0.001, 1.13, 1.15, 1.12, 1.14])
    expect(mapPivotRows([eur, btc]).map((quote) => quote.symbol)).toEqual(['BINANCE:BTCUSDT', 'FX:EURUSD'])
  })

  it('falls back to the close when the previous open is missing', () => {
    const quote = mapPivotRows([row('BINANCE:BTCUSDT', ['BTCUSDT', 'Bitcoin', 86_000, 1, 1, null, 88_000, 83_000, 85_000])])[0]
    expect(quote.previous.open).toBe(85_000)
  })

  it('drops rows with unusable data and unknown tickers', () => {
    const rows = [
      row('BINANCE:ETHUSDT', ['ETHUSDT', 'Ethereum', 3_000, 1, 1, 1, null, 1, 1]),
      row('BINANCE:SOLUSDT', ['SOLUSDT', 'Solana', 100, 1, 1, 1, 90, 95, 92]),
      row('NOPE:NOPE', ['NOPE', 'Nope', 1, 1, 1, 1, 2, 1, 1]),
    ]
    expect(mapPivotRows(rows)).toEqual([])
  })
})
