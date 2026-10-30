import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ scan: vi.fn(), prices: vi.fn() }))

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }))
vi.mock('./markets', () => ({ scanTradingView: mocks.scan }))
vi.mock('./prices', () => ({ getCachedPrices: mocks.prices }))

// The snapshot lives in module state, so every test loads a fresh copy
async function loadTicker() {
  vi.resetModules()
  return import('./ticker')
}

// Answers for every ticker asked, so the scanner "covers" the whole bar
const coverEverything = (close = 100) =>
  mocks.scan.mockImplementation(async (tickers: string[]) => tickers.map((s) => ({ s, d: [close, 1] })))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-01-10T12:00:00Z'))
  mocks.scan.mockReset()
  mocks.prices.mockReset()
  mocks.prices.mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('getLiveTickerSnapshot', () => {
  it('shares one upstream request between concurrent callers', async () => {
    coverEverything()
    const { getLiveTickerSnapshot } = await loadTicker()

    const [a, b] = await Promise.all([getLiveTickerSnapshot(), getLiveTickerSnapshot()])

    expect(mocks.scan).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('reuses the snapshot for 2 seconds and refreshes after that', async () => {
    coverEverything(100)
    const { getLiveTickerSnapshot } = await loadTicker()
    const first = await getLiveTickerSnapshot()

    vi.setSystemTime(new Date('2026-01-10T12:00:01.900Z'))
    expect(await getLiveTickerSnapshot()).toBe(first)
    expect(mocks.scan).toHaveBeenCalledTimes(1)

    coverEverything(101)
    vi.setSystemTime(new Date('2026-01-10T12:00:02.100Z'))
    const second = await getLiveTickerSnapshot()

    expect(mocks.scan).toHaveBeenCalledTimes(2)
    expect(second.quotes[0].price).toBe(101)
    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
  })

  it('does not query the price providers while the scanner covers every asset', async () => {
    coverEverything()
    const { getLiveTickerSnapshot } = await loadTicker()

    await getLiveTickerSnapshot()

    expect(mocks.prices).not.toHaveBeenCalled()
  })

  it('asks the price providers only when the scanner leaves assets uncovered', async () => {
    mocks.scan.mockResolvedValue([{ s: 'BINANCE:BTCUSDT', d: [65_000, 1] }])
    mocks.prices.mockResolvedValue([
      { symbol: 'ETH', price: 3_200, change24h: 0, changePercent24h: 1, source: 'test', timestamp: 0 },
    ])
    const { getLiveTickerSnapshot } = await loadTicker()

    const snapshot = await getLiveTickerSnapshot()

    expect(mocks.prices).toHaveBeenCalledTimes(1)
    expect(snapshot.quotes.map((quote) => quote.symbol)).toEqual(['BTC', 'ETH'])
  })

  it('keeps serving the last good quotes for up to a minute when providers fail', async () => {
    coverEverything()
    const { getLiveTickerSnapshot } = await loadTicker()
    const good = await getLiveTickerSnapshot()

    mocks.scan.mockRejectedValue(new Error('scanner down'))

    vi.setSystemTime(new Date('2026-01-10T12:00:10Z'))
    expect(await getLiveTickerSnapshot()).toBe(good)

    vi.setSystemTime(new Date('2026-01-10T12:01:01Z'))
    await expect(getLiveTickerSnapshot()).rejects.toThrow('No ticker quotes available')
  })

  it('fails when there is nothing to serve yet', async () => {
    mocks.scan.mockRejectedValue(new Error('scanner down'))
    const { getLiveTickerSnapshot } = await loadTicker()

    await expect(getLiveTickerSnapshot()).rejects.toThrow('No ticker quotes available')
  })

  it('recovers on the next call after a failed refresh', async () => {
    mocks.scan.mockRejectedValueOnce(new Error('blip'))
    coverEverything()
    const { getLiveTickerSnapshot } = await loadTicker()

    await expect(getLiveTickerSnapshot()).rejects.toThrow()
    const snapshot = await getLiveTickerSnapshot()

    expect(snapshot.quotes.length).toBeGreaterThan(0)
  })

  // Catalogo de 84 activos (20 futuros `1!`): verificado en vivo (2026-10-22) que el scanner responde las 84 filas
  // en un solo pedido, y tambien 168 tickers juntos, asi que el ticker no necesita lotes como lib/markets.ts.
  it('asks for the whole catalog in a single scanner request, futures included', async () => {
    coverEverything()
    const { getLiveTickerSnapshot } = await loadTicker()

    const snapshot = await getLiveTickerSnapshot()

    expect(mocks.scan).toHaveBeenCalledTimes(1)
    const [tickers] = mocks.scan.mock.calls[0] as [string[]]
    expect(new Set(tickers).size).toBe(tickers.length)
    expect(tickers.filter((tv) => tv.endsWith('1!')).length).toBeGreaterThanOrEqual(20)
    expect(tickers).toEqual(expect.arrayContaining(['CME_MINI:ES1!', 'CME_MINI:NQ1!', 'EUREX:FDAX1!']))
    expect(snapshot.quotes).toHaveLength(tickers.length)
  })

  it('keeps the rest of the bar when the scanner skips some futures and the providers do not know them', async () => {
    mocks.scan.mockImplementation(async (tickers: string[]) =>
      tickers.filter((tv) => tv !== 'EUREX:FDAX1!').map((s) => ({ s, d: [100, 1] }))
    )
    const { getLiveTickerSnapshot } = await loadTicker()

    const snapshot = await getLiveTickerSnapshot()

    const symbols = snapshot.quotes.map((quote) => quote.symbol)
    expect(symbols).toContain('ES')
    expect(symbols).not.toContain('FDAX')
    // el fallback si se consulta, porque quedo un activo sin cubrir
    expect(mocks.prices).toHaveBeenCalledTimes(1)
  })
})
