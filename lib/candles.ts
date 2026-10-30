import { ASSETS } from './assets-catalog'

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

// Derivado de lib/assets-catalog.ts (campo `yahoo`) — antes esto era un objeto a mano con 31
// claves, 7 de ellas ('COMEX:XAUUSD', 'COMEX:XAGUSD', 'COMEX:PL', 'COMEX:PA', 'TVC:DAX',
// 'TVC:NIKKEI', 'TVC:FTSE') sin ningun activo del catalogo que las use — ningun ticker real le
// pegaba nunca a esas entradas, confirmado contra MARKET_ASSETS antes de borrarlas.
const FIXED_MAP: Record<string, string> = Object.fromEntries(
  ASSETS.filter((a) => a.yahoo !== undefined).map((a) => [a.tv, a.yahoo as string])
)

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

// Groups ascending candles into buckets of `seconds`; volume is summed when present.
// `offsetSeconds` shifts the bucket grid so session series keep their stamp (US stocks :30):
// buckets land at floor((time − offset) / seconds) * seconds + offset. Offset 0 = UTC-aligned.
export function aggregateCandles(candles: Candle[], seconds: number, offsetSeconds = 0): Candle[] {
  const out: Candle[] = []
  for (const candle of candles) {
    const bucket = Math.floor((candle.time - offsetSeconds) / seconds) * seconds + offsetSeconds
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

// Folds a trailing bar that sits closer to its predecessor than the given gap into it (see TimeframeSpec.minGapSeconds).
// Yahoo stamps the current in-progress week/month either at its start (session assets) or mid-period (forex and other
// 24h classes, where the previous bar sits at the closed period's end): only a duplicate of the SAME period may fold —
// folding across a period boundary would swallow the in-progress week or month into the closed one.
export function mergePartialTail(candles: Candle[], minGapSeconds: number, period?: 'week' | 'month'): Candle[] {
  if (candles.length < 2) return candles
  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]
  if (last.time - previous.time >= minGapSeconds) return candles

  if (period === 'month' && !sameUtcMonth(last.time, previous.time)) return candles
  if (period === 'week' && isoWeekStart(last.time) !== isoWeekStart(previous.time)) return candles

  const merged: Candle = { ...previous, high: Math.max(previous.high, last.high), low: Math.min(previous.low, last.low), close: last.close }
  return [...candles.slice(0, -2), merged]
}

function sameUtcMonth(a: number, b: number): boolean {
  const left = new Date(a * 1000)
  const right = new Date(b * 1000)
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth()
}

// Start of the Monday-based UTC week containing `time` (epoch seconds)
function isoWeekStart(time: number): number {
  const daysSinceMonday = (new Date(time * 1000).getUTCDay() + 6) % 7
  return Math.floor((time - daysSinceMonday * 86_400) / 86_400) * 86_400
}

// Yahoo appends a bar stamped "now" to intraday data: for indices its open/high/low arrive as 0 and get rebuilt
// as a doji, leaving a stub stamped mid-bucket with no range of its own. Fold it onto the bucket the series itself
// is stamped to (US stocks sit on the session's :30, not on the UTC hour) or drop it when that bucket already
// carries a real bar, so the chart never shows a stray half-width candle.
export function collapsePhantomTail(candles: Candle[], bucketSeconds: number): Candle[] {
  if (!candles.length || bucketSeconds <= 0) return candles
  const last = candles[candles.length - 1]
  if (last.open !== last.high || last.high !== last.low || last.low !== last.close) return candles
  if (last.volume !== undefined) return candles

  const head = candles.slice(0, -1)
  const offset = head.length ? head[head.length - 1].time % bucketSeconds : 0
  const bucket = Math.floor((last.time - offset) / bucketSeconds) * bucketSeconds + offset
  if (bucket === last.time) return candles
  const tail = head[head.length - 1]
  if (tail && tail.time === bucket) return head
  return [...head, { ...last, time: bucket }]
}

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '2m': 120,
  '5m': 300,
  '15m': 900,
  '30m': 1_800,
  '60m': 3_600,
  '90m': 5_400,
  '1h': 3_600,
  '1d': 86_400,
  '5d': 432_000,
  '1wk': 604_800,
  // 31 days: a month bar stamped on the 1st still belongs to its month on day 31
  '1mo': 2_678_400,
}

export function intervalSeconds(interval: string): number {
  return INTERVAL_SECONDS[interval] ?? 3_600
}

// Sobre la última vela pega el precio en vivo del scanner: el cierre se reescribe y la mecha
// se extiende si el tick supera el máximo o se hunde bajo el mínimo. Nunca muta la entrada y
// las velas anteriores conservan su referencia, para que los indicadores derivados no rehagan nada.
// Con `bucketSeconds`, solo se muta si la vela todavía pertenece al bucket abierto: un tick nunca
// reescribe historia de un período ya cerrado (after-hours, fin de semana, datos stale).
export function applyLiveTick(candles: Candle[], liveClose: number, bucketSeconds?: number, nowSeconds = Math.floor(Date.now() / 1000)): Candle[] {
  const out = [...candles]
  if (!out.length || !Number.isFinite(liveClose) || liveClose <= 0) return out
  const last = out[out.length - 1]
  if (bucketSeconds && nowSeconds - last.time >= bucketSeconds) return out
  out[out.length - 1] = { ...last, close: liveClose, high: Math.max(last.high, liveClose), low: Math.min(last.low, liveClose) }
  return out
}
