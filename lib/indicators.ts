import type { Candle } from './candles'

// Simple moving average; the first `period - 1` positions have no value yet
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (period < 1 || values.length < period) return out

  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

// Exponential moving average, seeded with the simple average of the first `period` values
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (period < 1 || values.length < period) return out

  const k = 2 / (period + 1)
  let previous = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  out[period - 1] = previous
  for (let i = period; i < values.length; i++) {
    previous = values[i] * k + previous * (1 - k)
    out[i] = previous
  }
  return out
}

// Relative Strength Index with Wilder smoothing; the first `period` positions have no value yet
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (period < 1 || values.length <= period) return out

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period
  out[period] = rsiLevel(avgGain, avgLoss)

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period
    out[i] = rsiLevel(avgGain, avgLoss)
  }
  return out
}

// Without losses the ratio is unbounded: convention pins the index at its maximum
function rsiLevel(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export interface MacdResult {
  macd: (number | null)[]
  signal: (number | null)[]
  histogram: (number | null)[]
}

// MACD line = EMA(12) − EMA(26); signal = EMA(9) of the macd line; histogram = macd − signal
export function macd(values: number[]): MacdResult {
  const fast = ema(values, 12)
  const slow = ema(values, 26)
  const line: (number | null)[] = values.map((_, i) => (fast[i] !== null && slow[i] !== null ? (fast[i] as number) - (slow[i] as number) : null))

  // The signal EMA runs over the macd line only where the line exists, re-anchored to the tail
  const compact = line.filter((value): value is number => value !== null)
  const compactSignal = ema(compact, 9)
  const signal: (number | null)[] = new Array(values.length).fill(null)
  const anchor = line.length - compact.length
  for (let i = 0; i < compactSignal.length; i++) {
    if (compactSignal[i] !== null) signal[i + anchor] = compactSignal[i]
  }

  const histogram: (number | null)[] = line.map((value, i) => (value !== null && signal[i] !== null ? value - (signal[i] as number) : null))
  return { macd: line, signal, histogram }
}

export interface LinePoint {
  time: number
  value: number
}

// Pairs an indicator with its candles, dropping the warm-up positions that have no value
export function toLinePoints(candles: Candle[], values: (number | null)[]): LinePoint[] {
  const points: LinePoint[] = []
  for (let i = 0; i < candles.length; i++) {
    const value = values[i]
    if (value !== null && value !== undefined) points.push({ time: candles[i].time, value })
  }
  return points
}

export type IndicatorKey = 'sma20' | 'sma50' | 'sma200' | 'ema20'

// Locale-agnostic on purpose: no display strings here. Callers resolve the label for a given
// `key` from `dict.indicators[key]` (see components/ui/MarketChart.tsx) so this file never has
// to know about the active locale.
export interface IndicatorSpec {
  key: IndicatorKey
  color: string
  compute: (closes: number[]) => (number | null)[]
}

export const INDICATORS: IndicatorSpec[] = [
  { key: 'sma20', color: '#f5a524', compute: (closes) => sma(closes, 20) },
  { key: 'sma50', color: '#a78bfa', compute: (closes) => sma(closes, 50) },
  { key: 'sma200', color: '#e5e2e1', compute: (closes) => sma(closes, 200) },
  { key: 'ema20', color: '#22d3ee', compute: (closes) => ema(closes, 20) },
]

export type OscillatorKey = 'rsi' | 'macd'

// Oscillators render in their own chart pane below the price, not overlaid on it. Labels
// resolve from `dict.indicators[key]` the same way overlays do (see MarketChart.tsx).
export interface OscillatorSpec {
  key: OscillatorKey
  color: string
}

export const OSCILLATORS: OscillatorSpec[] = [
  { key: 'rsi', color: '#f472b6' },
  { key: 'macd', color: '#60a5fa' },
]
