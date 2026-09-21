import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }))

// A route matches when its key appears in the requested URL; an Error value makes the request fail
function stubFetch(routes: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((route) => url.includes(route))
      if (!key) return { ok: false, status: 404, json: async () => ({}) }
      const value = routes[key]
      if (value instanceof Error) throw value
      return { ok: true, status: 200, json: async () => value }
    })
  )
}

// prices.ts keeps the last good snapshot in module state, so every test loads a fresh copy
async function loadPrices() {
  vi.resetModules()
  return import('./prices')
}

const coingecko = {
  bitcoin: { usd: 65_000, usd_24h_change: 2 },
  ethereum: { usd: 0, usd_24h_change: 1 },
  solana: { usd: 150, usd_24h_change: -1 },
  'pax-gold': { usd: 2_400 },
}

beforeEach(() => {
  vi.stubEnv('FINNHUB_API_KEY', '')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('fetchAllPrices', () => {
  it('maps CoinGecko quotes and skips assets without a positive price', async () => {
    stubFetch({ 'coingecko.com': coingecko, 'frankfurter.dev': { rates: {} } })
    const { fetchAllPrices } = await loadPrices()

    const prices = await fetchAllPrices()
    const bySymbol = Object.fromEntries(prices.map((price) => [price.symbol, price]))

    expect(Object.keys(bySymbol).sort()).toEqual(['BTC', 'SOL', 'XAUUSD'])
    expect(bySymbol.BTC).toMatchObject({ price: 65_000, changePercent24h: 2, source: 'coingecko' })
    expect(bySymbol.BTC.change24h).toBeCloseTo(65_000 - 65_000 / 1.02)
    expect(bySymbol.SOL.change24h).toBeLessThan(0)
    expect(bySymbol.XAUUSD.changePercent24h).toBe(0)
  })

  it('falls back to Yahoo when CoinGecko fails', async () => {
    stubFetch({
      'coingecko.com': new Error('HTTP 429'),
      'query1.finance.yahoo.com': { chart: { result: [{ meta: { regularMarketPrice: 100, chartPreviousClose: 80 } }] } },
      'frankfurter.dev': { rates: {} },
    })
    const { fetchAllPrices } = await loadPrices()

    const prices = await fetchAllPrices()

    expect(prices.map((price) => price.symbol).sort()).toEqual(['BTC', 'ETH', 'SOL', 'XAUUSD'])
    expect(prices[0]).toMatchObject({ source: 'yahoo', price: 100, change24h: 20, changePercent24h: 25 })
  })

  it('derives the forex change from the last two ECB fixings', async () => {
    stubFetch({
      'coingecko.com': {},
      'frankfurter.dev': { rates: { '2026-01-09': { USD: 1.12 }, '2026-01-08': { USD: 1.1 } } },
    })
    const { fetchAllPrices } = await loadPrices()

    const prices = await fetchAllPrices()
    const eurusd = prices.find((price) => price.symbol === 'EURUSD')

    expect(eurusd).toMatchObject({ price: 1.12, source: 'frankfurter' })
    expect(eurusd?.change24h).toBeCloseTo(0.02)
    expect(eurusd?.changePercent24h).toBeCloseTo((0.02 / 1.1) * 100)
  })

  it('scales the SPY and UUP proxies into SPX and DXY levels', async () => {
    vi.stubEnv('FINNHUB_API_KEY', 'test-key')
    stubFetch({ 'coingecko.com': {}, 'frankfurter.dev': { rates: {} }, 'finnhub.io': { c: 500, d: 5, dp: 1 } })
    const { fetchAllPrices } = await loadPrices()

    const bySymbol = Object.fromEntries((await fetchAllPrices()).map((price) => [price.symbol, price]))

    expect(bySymbol.AAPL.price).toBe(500)
    expect(bySymbol.SPX.price).toBeCloseTo(500 * 10.09)
    expect(bySymbol.DXY.price).toBeCloseTo(500 * 3.71)
    expect(bySymbol.SPX.changePercent24h).toBe(1)
  })

  it('does not call Finnhub without an API key', async () => {
    stubFetch({ 'coingecko.com': coingecko, 'frankfurter.dev': { rates: {} } })
    const { fetchAllPrices } = await loadPrices()

    await fetchAllPrices()

    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.includes('finnhub.io'))).toBe(false)
  })

  it('keeps the last good price for up to 15 minutes when a provider goes down', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'))
    stubFetch({ 'coingecko.com': coingecko, 'frankfurter.dev': { rates: {} } })
    const { fetchAllPrices } = await loadPrices()
    await fetchAllPrices()

    stubFetch({ 'coingecko.com': new Error('down'), 'query1.finance.yahoo.com': {}, 'frankfurter.dev': { rates: {} } })

    vi.setSystemTime(new Date('2026-01-10T12:10:00Z'))
    expect((await fetchAllPrices()).map((price) => price.symbol)).toContain('BTC')

    vi.setSystemTime(new Date('2026-01-10T12:16:00Z'))
    expect((await fetchAllPrices()).map((price) => price.symbol)).not.toContain('BTC')
  })
})
