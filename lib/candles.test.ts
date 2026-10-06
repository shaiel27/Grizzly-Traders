import { describe, expect, it } from 'vitest'
import { PIVOT_ASSETS } from './pivot-assets'
import { toYahooSymbol } from './candles'

describe('toYahooSymbol', () => {
  it('maps the scanner tickers used for commodities and indices', () => {
    expect(toYahooSymbol('OANDA:XAUUSD')).toBe('GC=F')
    expect(toYahooSymbol('ICEEUR:BRN1!')).toBe('BZ=F')
    expect(toYahooSymbol('DJ:DJI')).toBe('^DJI')
    expect(toYahooSymbol('TVC:DEU40')).toBe('^GDAXI')
  })

  it('derives crypto, forex and stock symbols from the exchange', () => {
    expect(toYahooSymbol('BINANCE:BTCUSDT')).toBe('BTC-USD')
    expect(toYahooSymbol('FX:EURUSD')).toBe('EURUSD=X')
    expect(toYahooSymbol('NASDAQ:AAPL')).toBe('AAPL')
  })

  it('returns null for malformed tickers', () => {
    expect(toYahooSymbol('NOEXCHANGE')).toBeNull()
  })

  it('has a chart for every pivot asset except the 2-year yield, which Yahoo does not publish', () => {
    const missing = PIVOT_ASSETS.filter((asset) => !toYahooSymbol(asset.tv)).map((asset) => asset.tv)
    expect(missing).toEqual(['TVC:US02Y'])
  })
})

describe('terminal catalog', () => {
  it('has a chart for every asset except the 2-year yield, which Yahoo does not publish', async () => {
    const { MARKET_ASSETS } = await import('./market-assets')
    const missing = MARKET_ASSETS.filter((asset) => !toYahooSymbol(asset.symbol)).map((asset) => asset.symbol)
    expect(missing).toEqual(['TVC:US02Y'])
  })

  it('has no duplicated tickers', async () => {
    const { MARKET_ASSETS } = await import('./market-assets')
    const symbols = MARKET_ASSETS.map((asset) => asset.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
  })
})
