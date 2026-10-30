import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }))

import { isPivotTimeframe, mapPivotRows, mapWithLimit, pivotColumns, previousBarFromCandles, previousFromClassicPivots, rowsNeedingYahoo } from './pivot-data'

const row = (s: string, d: unknown[]) => ({ s, d })

describe('pivotColumns', () => {
  it('asks for the previous bar of the requested timeframe', () => {
    expect(pivotColumns('D')).toContain('high[1]')
    expect(pivotColumns('W')).toEqual(expect.arrayContaining(['high[1]|1W', 'low[1]|1W', 'close[1]|1W', 'open[1]|1W']))
    expect(pivotColumns('M')).toContain('close[1]|1M')
  })

  it('never requests the scanner monthly pivot columns for the daily and weekly levels', () => {
    expect(pivotColumns('D').some((column) => column.startsWith('Pivot.'))).toBe(false)
    expect(pivotColumns('W').some((column) => column.startsWith('Pivot.'))).toBe(false)
  })

  // Continuous futures (1!) come back null for |1M, but their Pivot.M.Classic.* are the previous month's levels
  it('adds the classic monthly pivots only as a fallback for the monthly timeframe', () => {
    expect(pivotColumns('M').slice(-3)).toEqual(['Pivot.M.Classic.Middle', 'Pivot.M.Classic.R1', 'Pivot.M.Classic.S1'])
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

describe('mapPivotRows con futuros', () => {
  // Valores reales del scanner (2026-10-22) para el contrato continuo
  const es = row('CME_MINI:ES1!', ['ES1!', 'E-mini S&P 500 Futures', 7692.25, -1.38, -108, 7785, 7812.25, 7751, 7800.25])
  const fdax = row('EUREX:FDAX1!', ['FDAX1!', 'DAX Futures', 25508, -1.01, -261, 25527, 25833, 25371, 25769])

  it('procesa filas de futuros con el HLC del periodo anterior', () => {
    const quotes = mapPivotRows([es, fdax])
    expect(quotes.map((quote) => quote.symbol)).toEqual(['CME_MINI:ES1!', 'EUREX:FDAX1!'])
    expect(quotes[0].previous).toEqual({ open: 7785, high: 7812.25, low: 7751, close: 7800.25 })
    expect(quotes[1].previous).toEqual({ open: 25527, high: 25833, low: 25371, close: 25769 })
  })

  it('en el marco semanal/mensual el scanner devuelve null para 1!: la fila se descarta sin romper', () => {
    const sinHlc = row('CME_MINI:ES1!', ['ES1!', 'E-mini S&P 500 Futures', 7692.25, -1.38, -108, null, null, null, null])
    expect(mapPivotRows([sinHlc])).toEqual([])
  })

  it('usa los pivotes clasicos mensuales cuando el HLC viene null', () => {
    const mensual = row('CME_MINI:ES1!', ['ES1!', 'E-mini S&P 500 Futures', 7692.25, -1.38, -108, null, null, null, null, 7713, 7851, 7577.5])
    const [quote] = mapPivotRows([mensual])
    expect(quote.previous).toEqual({ open: 7715.5, high: 7848.5, low: 7575, close: 7715.5 })
  })

  it('usa el respaldo externo (velas) cuando no hay HLC ni pivotes clasicos', () => {
    const sinHlc = row('CME_MINI:ES1!', ['ES1!', 'E-mini S&P 500 Futures', 7692.25, -1.38, -108, null, null, null, null])
    const respaldo = new Map([['CME_MINI:ES1!', { open: 7873, high: 7887, low: 7676, close: 7704.25 }]])
    expect(mapPivotRows([sinHlc], respaldo)[0].previous).toEqual({ open: 7873, high: 7887, low: 7676, close: 7704.25 })
  })

  it('mensual: la barra de Yahoo (apertura real) gana sobre los pivotes clasicos', () => {
    const mensual = row('CME_MINI:ES1!', ['ES1!', 'E-mini S&P 500 Futures', 7692.25, -1.38, -108, null, null, null, null, 7713, 7851, 7577.5])
    const yahoo = new Map([['CME_MINI:ES1!', { open: 7873, high: 7887, low: 7676, close: 7704.25 }]])
    expect(mapPivotRows([mensual], yahoo)[0].previous).toEqual({ open: 7873, high: 7887, low: 7676, close: 7704.25 })
  })

  it('mensual: sin datos de Yahoo se usan los pivotes clasicos', () => {
    const mensual = row('CME_MINI:ES1!', ['ES1!', 'E-mini S&P 500 Futures', 7692.25, -1.38, -108, null, null, null, null, 7713, 7851, 7577.5])
    expect(mapPivotRows([mensual], new Map())[0].previous.high).toBe(7848.5)
  })

  it('el HLC del scanner gana sobre el respaldo', () => {
    const respaldo = new Map([['CME_MINI:ES1!', { open: 1, high: 3, low: 1, close: 2 }]])
    expect(mapPivotRows([es], respaldo)[0].previous.high).toBe(7812.25)
  })
})

describe('previousFromClassicPivots', () => {
  it('recupera H, L y C a partir de P, R1 y S1', () => {
    expect(previousFromClassicPivots(7713, 7851, 7577.5)).toEqual({ open: 7715.5, high: 7848.5, low: 7575, close: 7715.5 })
  })

  it('devuelve null con datos faltantes o incoherentes', () => {
    expect(previousFromClassicPivots(null, 7851, 7577.5)).toBeNull()
    expect(previousFromClassicPivots(7713, undefined, 7577.5)).toBeNull()
    // R1 por debajo de S1 daria high < low
    expect(previousFromClassicPivots(7713, 7500, 7900)).toBeNull()
  })
})

describe('previousBarFromCandles', () => {
  const dia = 86_400
  const lunes = Date.UTC(2026, 9, 5, 4) / 1000
  const vela = (time: number, high: number, low: number, close: number) => ({ time, open: close, high, low, close })

  // Yahoo (ES=F, 1wk): la semana en curso y, ademas, una barra estampada "ahora" que repite el dia
  it('semanal: funde la barra de "ahora" y devuelve la semana cerrada', () => {
    const candles = [
      vela(lunes, 7897.5, 7760.25, 7859.75),
      vela(lunes + 7 * dia, 7887, 7676, 7704.25),
      vela(lunes + 14 * dia, 7812.25, 7677, 7800.25),
      vela(lunes + 17 * dia + 40_000, 7798.75, 7686.25, 7693.75),
    ]
    expect(previousBarFromCandles(candles, 'W')).toMatchObject({ high: 7887, low: 7676, close: 7704.25 })
  })

  it('devuelve null con menos de dos barras', () => {
    expect(previousBarFromCandles([vela(lunes, 2, 1, 1.5)], 'W')).toBeNull()
  })
})

describe('rowsNeedingYahoo', () => {
  it('pide Yahoo solo para filas con precio y sin HLC del scanner, aunque tengan pivotes clasicos', () => {
    const conClasicos = row('CME_MINI:ES1!', ['ES1!', 'x', 7692.25, 0, 0, null, null, null, null, 7713, 7851, 7577.5])
    const completa = row('EUREX:FDAX1!', ['FDAX1!', 'x', 25508, 0, 0, 25527, 25833, 25371, 25769])
    const sinPrecio = row('CME_MINI:NQ1!', ['NQ1!', 'x', null, 0, 0, null, null, null, null])
    expect(rowsNeedingYahoo([conClasicos, completa, sinPrecio]).map((r) => r.s)).toEqual(['CME_MINI:ES1!'])
  })
})

describe('mapWithLimit', () => {
  it('no supera la concurrencia pedida y conserva el orden', async () => {
    let enVuelo = 0
    let maximo = 0
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (n) => {
      enVuelo++
      maximo = Math.max(maximo, enVuelo)
      await new Promise((resolve) => setTimeout(resolve, 5))
      enVuelo--
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
    expect(maximo).toBe(3)
  })
})
