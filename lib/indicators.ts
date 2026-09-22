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

export interface IndicatorSpec {
  key: IndicatorKey
  label: string
  color: string
  compute: (closes: number[]) => (number | null)[]
}

export const INDICATORS: IndicatorSpec[] = [
  { key: 'sma20', label: 'Media móvil 20', color: '#f5a524', compute: (closes) => sma(closes, 20) },
  { key: 'sma50', label: 'Media móvil 50', color: '#a78bfa', compute: (closes) => sma(closes, 50) },
  { key: 'sma200', label: 'Media móvil 200', color: '#e5e2e1', compute: (closes) => sma(closes, 200) },
  { key: 'ema20', label: 'Media exponencial 20', color: '#22d3ee', compute: (closes) => ema(closes, 20) },
]
