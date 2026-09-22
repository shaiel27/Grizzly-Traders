export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  // Absent for forex and most indices, where Yahoo has no real volume
  volume?: number
}

export interface TimeframeSpec {
  // Text on the button
  label: string
  // Candle size Yahoo is asked for
  interval: string
  // How much history to load: enough candles to read the trend and warm up a 200-period average
  range: string
  // Yahoo has no 4-hour candles, so they are built from hourly ones
  aggregateSeconds?: number
  // Yahoo appends a bar stamped 'now' to weekly and monthly data that repeats the current day; a last bar closer
  // to the previous one than this is that partial bar and gets merged into it
  minGapSeconds?: number
  // Server cache lifetime: short for the timeframes that move every minute
  ttlMs: number
  intraday: boolean
}

export const TIMEFRAMES = {
  '1m': { label: '1m', interval: '1m', range: '1d', ttlMs: 15_000, intraday: true },
  '5m': { label: '5m', interval: '5m', range: '5d', ttlMs: 30_000, intraday: true },
  '15m': { label: '15m', interval: '15m', range: '1mo', ttlMs: 60_000, intraday: true },
  '1h': { label: '1h', interval: '60m', range: '3mo', ttlMs: 60_000, intraday: true },
  '4h': { label: '4h', interval: '60m', range: '6mo', aggregateSeconds: 4 * 3600, ttlMs: 120_000, intraday: true },
  '1d': { label: '1D', interval: '1d', range: '2y', ttlMs: 300_000, intraday: false },
  '1w': { label: '1W', interval: '1wk', range: '10y', minGapSeconds: 6 * 86_400, ttlMs: 600_000, intraday: false },
  '1mo': { label: '1M', interval: '1mo', range: '20y', minGapSeconds: 27 * 86_400, ttlMs: 900_000, intraday: false },
} as const satisfies Record<string, TimeframeSpec>

export type TimeframeKey = keyof typeof TIMEFRAMES

export const TIMEFRAME_KEYS = Object.keys(TIMEFRAMES) as TimeframeKey[]

export function isTimeframe(value: string): value is TimeframeKey {
  return Object.hasOwn(TIMEFRAMES, value)
}

const FIXED_MAP: Record<string, string> = {
  'COMEX:XAUUSD': 'GC=F',
  'COMEX:XAGUSD': 'SI=F',
  'COMEX:PL': 'PL=F',
  'COMEX:PA': 'PA=F',
  'OANDA:XAUUSD': 'GC=F',
  'TVC:SILVER': 'SI=F',
  'ICEEUR:BRN1!': 'BZ=F',
  'NYMEX:CL1!': 'CL=F',
  'NYMEX:NG1!': 'NG=F',
  'TVC:DJI': '^DJI',
  'TVC:DEU40': '^GDAXI',
  'TVC:UKX': '^FTSE',
  'TVC:NI225': '^N225',
  'COMEX:HG1!': 'HG=F',
  'TVC:PLATINUM': 'PL=F',
  'TVC:PALLADIUM': 'PA=F',
  'CBOT:ZC1!': 'ZC=F',
  'CBOT:ZW1!': 'ZW=F',
  'ICEUS:SB1!': 'SB=F',
  'ICEUS:KC1!': 'KC=F',
  'TVC:VIX': '^VIX',
  'TVC:CAC40': '^FCHI',
  'TVC:SX5E': '^STOXX50E',
  'SP:SPX': '^GSPC',
  'NASDAQ:NDX': '^NDX',
  'TVC:DXY': 'DX-Y.NYB',
  'TVC:US10Y': '^TNX',
  'TVC:DAX': '^GDAXI',
  'TVC:NIKKEI': '^N225',
  'TVC:HSI': '^HSI',
  'TVC:FTSE': '^FTSE',
}

// Maps a TradingView ticker (as used by /api/markets) to its Yahoo Finance symbol.
export function toYahooSymbol(tvSymbol: string): string | null {
  const fixed = FIXED_MAP[tvSymbol]
  if (fixed) return fixed

  const [exchange, ticker] = tvSymbol.split(':')
  if (!exchange || !ticker) return null

  if (exchange === 'BINANCE' && ticker.endsWith('USDT')) return `${ticker.slice(0, -4)}-USD`
  if (exchange === 'FX' && ticker.length === 6) return `${ticker}=X`
  if (exchange === 'NASDAQ' || exchange === 'NYSE') return ticker

  return null
}

interface YahooChartResponse {
  chart?: {
    result?: {
      timestamp?: number[]
      indicators?: {
        quote?: {
          open?: (number | null)[]
          high?: (number | null)[]
          low?: (number | null)[]
          close?: (number | null)[]
          volume?: (number | null)[]
        }[]
      }
    }[]
  }
}

export function parseYahooCandles(payload: YahooChartResponse): Candle[] {
  const result = payload.chart?.result?.[0]
  const quote = result?.indicators?.quote?.[0]
  const times = result?.timestamp
  if (!times || !quote?.open || !quote.high || !quote.low || !quote.close) return []

  const candles: Candle[] = []
  for (let i = 0; i < times.length; i++) {
    const rawOpen = quote.open[i]
    const rawHigh = quote.high[i]
    const rawLow = quote.low[i]
    const close = quote.close[i]
    if (close == null || !(close > 0)) continue

    // Yahoo sometimes sends the live bar of an index with open, high and low at 0: rebuild them from what is known
    const open = rawOpen != null && rawOpen > 0 ? rawOpen : close
    const high = rawHigh != null && rawHigh > 0 ? rawHigh : Math.max(open, close)
    const low = rawLow != null && rawLow > 0 ? rawLow : Math.min(open, close)

    const volume = quote.volume?.[i]
    candles.push({ time: times[i], open, high, low, close, ...(typeof volume === 'number' && volume > 0 ? { volume } : {}) })
  }
  return candles
}

// Groups ascending candles into buckets of `seconds` (UTC-aligned); volume is summed when present
export function aggregateCandles(candles: Candle[], seconds: number): Candle[] {
  const out: Candle[] = []
  for (const candle of candles) {
    const bucket = Math.floor(candle.time / seconds) * seconds
    const last = out[out.length - 1]

    if (last && last.time === bucket) {
      last.high = Math.max(last.high, candle.high)
      last.low = Math.min(last.low, candle.low)
      last.close = candle.close
      if (candle.volume !== undefined) last.volume = (last.volume ?? 0) + candle.volume
    } else {
      out.push({ ...candle, time: bucket })
    }
  }
  return out
}

// Ascending by time with no repeated timestamps (the last one wins): the chart library rejects anything else
export function normalizeCandles(candles: Candle[]): Candle[] {
  const sorted = [...candles].sort((a, b) => a.time - b.time)
  const out: Candle[] = []
  for (const candle of sorted) {
    if (out.length && out[out.length - 1].time === candle.time) out[out.length - 1] = candle
    else out.push(candle)
  }
  return out
}

// Folds a trailing bar that sits closer to its predecessor than the given gap into it (see TimeframeSpec.minGapSeconds)
export function mergePartialTail(candles: Candle[], minGapSeconds: number): Candle[] {
  if (candles.length < 2) return candles
  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  if (last.time - previous.time >= minGapSeconds) return candles

  const merged: Candle = { ...previous, high: Math.max(previous.high, last.high), low: Math.min(previous.low, last.low), close: last.close }
  return [...candles.slice(0, -2), merged]
}
