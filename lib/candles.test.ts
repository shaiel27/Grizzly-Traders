import { describe, expect, it } from 'vitest'
import { PIVOT_ASSETS } from './pivot-assets'
import { aggregateCandles, applyLiveTick, toYahooSymbol, type Candle } from './candles'

describe('applyLiveTick', () => {
  it('extends the last candle high with a tick above it and returns a new array', () => {
    const candles: Candle[] = [
      { time: 1_000, open: 10, high: 12, low: 9, close: 11 },
      { time: 2_000, open: 11, high: 13, low: 10, close: 12 },
    ]
    const out = applyLiveTick(candles, 15)
    expect(out).toEqual([
      { time: 1_000, open: 10, high: 12, low: 9, close: 11 },
      { time: 2_000, open: 11, high: 15, low: 10, close: 15 },
    ])
    expect(out).not.toBe(candles)
  })

  it('extends the last candle low with a tick below it', () => {
    const candles: Candle[] = [{ time: 2_000, open: 11, high: 13, low: 10, close: 12 }]
    const out = applyLiveTick(candles, 7)
    expect(out).toEqual([{ time: 2_000, open: 11, high: 13, low: 7, close: 7 }])
  })

  it('rewrites only the close when the tick stays inside the candle range', () => {
    const candles: Candle[] = [{ time: 2_000, open: 11, high: 13, low: 10, close: 12 }]
    const out = applyLiveTick(candles, 12.5)
    expect(out).toEqual([{ time: 2_000, open: 11, high: 13, low: 10, close: 12.5 }])
  })

  it('returns an empty array for empty input', () => {
    expect(applyLiveTick([], 100)).toEqual([])
  })

  it('leaves the candles unchanged when the live close is not a positive finite number', () => {
    const candles: Candle[] = [{ time: 2_000, open: 11, high: 13, low: 10, close: 12 }]
    for (const liveClose of [Number.NaN, Number.POSITIVE_INFINITY, 0, -7]) {
      expect(applyLiveTick(candles, liveClose)).toEqual([{ time: 2_000, open: 11, high: 13, low: 10, close: 12 }])
    }
  })

  it('never mutates the input array or its candles', () => {
    const first: Candle = { time: 1_000, open: 10, high: 12, low: 9, close: 11 }
    const last: Candle = { time: 2_000, open: 11, high: 13, low: 10, close: 12 }
    const candles = [first, last]

    const out = applyLiveTick(candles, 20)

    expect(candles).toEqual([
      { time: 1_000, open: 10, high: 12, low: 9, close: 11 },
      { time: 2_000, open: 11, high: 13, low: 10, close: 12 },
    ])
    expect(candles[0]).toBe(first)
    expect(candles[1]).toBe(last)
    expect(out[0]).toBe(first)
    expect(out[1]).not.toBe(last)
  })

  it('ticks a bar that still belongs to the open bucket', () => {
    const hour = 3_600
    const now = 1_770_000_000
    const candles: Candle[] = [{ time: now - 600, open: 11, high: 13, low: 10, close: 12 }]
    expect(applyLiveTick(candles, 14, hour, now)).toEqual([{ time: now - 600, open: 11, high: 14, low: 10, close: 14 }])
  })

  it('never rewrites a bar whose bucket already closed', () => {
    const hour = 3_600
    const now = 1_770_000_000
    const closed: Candle = { time: now - hour - 60, open: 11, high: 13, low: 10, close: 12 }
    expect(applyLiveTick([closed], 20, hour, now)).toEqual([closed])
  })
})

// Sin velas en Yahoo: el bono a 2 años y los 9 futuros de PLAN-FUTUROS.md §1 que dieron 404
// (o no tienen símbolo `=F`) en la verificación en vivo del 2026-10-22 — esos usan el widget de
// TradingView en vez del gráfico propio.
const SIN_VELAS_YAHOO = [
  'TVC:US02Y',
  'EUREX:FDAX1!',
  'EUREX:FESX1!',
  'ICEEUR:Z1!',
  'EURONEXT:FCE1!',
  'HKEX:HSI1!',
  'SGX:CN1!',
  'CBOE:VX1!',
  'ASX24:AP1!',
  'NSE:NIFTY1!',
]

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

  it('has a chart for every pivot asset except the 2-year yield and the 9 futures Yahoo does not publish', () => {
    const missing = PIVOT_ASSETS.filter((asset) => !toYahooSymbol(asset.tv)).map((asset) => asset.tv)
    expect(missing).toEqual(SIN_VELAS_YAHOO)
  })
})

describe('terminal catalog', () => {
  it('has a chart for every asset except the 2-year yield and the 9 futures Yahoo does not publish', async () => {
    const { MARKET_ASSETS } = await import('./market-assets')
    const missing = MARKET_ASSETS.filter((asset) => !toYahooSymbol(asset.symbol)).map((asset) => asset.symbol)
    expect(missing).toEqual(SIN_VELAS_YAHOO)
  })

  it('has no duplicated tickers', async () => {
    const { MARKET_ASSETS } = await import('./market-assets')
    const symbols = MARKET_ASSETS.map((asset) => asset.symbol)
    expect(new Set(symbols).size).toBe(symbols.length)
  })
})

// Futuros CME (ES=F, NQ=F...): cierran 1 h al dia (17:00-18:00 ET = 21:00 UTC en EDT) y abren el domingo 18:00 ET.
// Verificado con Yahoo real (ES=F, 60m, 1 mes, 2026-10-22): el 4h queda en la rejilla UTC (0/4/8/12/16/20) igual
// que forex y oro, sin desplazamiento; el hueco diario deja un bucket de 3 barras (20:00 UTC) y los bordes de
// semana buckets de 1 (cierre del viernes) o 2 barras (apertura del domingo): son sesiones reales, no velas partidas.
describe('aggregateCandles — futuros con hueco de sesion', () => {
  const H = 3_600
  const unaHora = (utc: number, hora: number): Candle => ({
    time: Date.UTC(2026, 9, utc, hora) / 1000,
    open: 100,
    high: 100 + hora,
    low: 100 - hora,
    close: 101,
    volume: 10,
  })
  // Lunes 19 y martes 20 de octubre 2026 (EDT): sin la barra de las 21:00 UTC
  const diaCme = (dia: number) => Array.from({ length: 24 }, (_, hora) => hora).filter((hora) => hora !== 21).map((hora) => unaHora(dia, hora))
  const serie = [...diaCme(19), ...diaCme(20)]

  it('mantiene la rejilla UTC de 4 h: ningun bucket queda desplazado', () => {
    const out = aggregateCandles(serie, 4 * H)
    expect(out.every((candle) => candle.time % (4 * H) === 0)).toBe(true)
    expect(out.map((candle) => new Date(candle.time * 1000).getUTCHours())).toEqual([0, 4, 8, 12, 16, 20, 0, 4, 8, 12, 16, 20])
  })

  it('el hueco de las 21:00 UTC se absorbe en el bucket de las 20:00 sin partir la vela', () => {
    const out = aggregateCandles(serie, 4 * H)
    const bucket20 = out[5]
    expect(bucket20.time).toBe(Date.UTC(2026, 9, 19, 20) / 1000)
    // 20:00, 22:00 y 23:00: tres barras en una sola vela con el rango y el volumen de las tres
    expect(bucket20.volume).toBe(30)
    expect(bucket20.high).toBe(100 + 23)
    expect(bucket20.low).toBe(100 - 23)
    expect(out.length).toBe(12)
  })

  it('el cierre del viernes (una sola barra) y la apertura del domingo (22:00 y 23:00) no crean buckets extra', () => {
    const viernes = [unaHora(16, 19), unaHora(16, 20)]
    const domingo = [unaHora(18, 22), unaHora(18, 23), unaHora(19, 0)]
    const out = aggregateCandles([...viernes, ...domingo], 4 * H)
    expect(out.map((candle) => candle.time)).toEqual([
      Date.UTC(2026, 9, 16, 16) / 1000, // 19:00 UTC
      Date.UTC(2026, 9, 16, 20) / 1000, // viernes 20:00 UTC, ultima hora antes del cierre
      Date.UTC(2026, 9, 18, 20) / 1000, // domingo 22:00 y 23:00 UTC
      Date.UTC(2026, 9, 19, 0) / 1000,
    ])
    expect(out[2].volume).toBe(20)
  })

  it('las velas de hora entera no necesitan offset: coincide con forex y oro', () => {
    const offset = serie[serie.length - 1].time % H
    expect(offset).toBe(0)
  })
})
