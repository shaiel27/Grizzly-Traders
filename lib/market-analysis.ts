export type Tone = 'positive' | 'negative' | 'neutral'

// Every possible reading these functions can return. Locale-agnostic on purpose: this file must never
// import from lib/i18n/* — callers resolve the copy via dict.marketAnalysis[key] (see AssetDetailPanel).
export type ReadingKey =
  | 'noData'
  | 'strongBuy'
  | 'buy'
  | 'sell'
  | 'strongSell'
  | 'neutral'
  | 'overbought'
  | 'oversold'
  | 'bullishAboveSignal'
  | 'bearishBelowSignal'
  | 'strongTrend'
  | 'noDefinedTrend'
  | 'moderateTrend'

export interface Reading {
  key: ReadingKey
  tone: Tone
}

const isNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

// TradingView's summary rating runs from -1 (strong sell) to +1 (strong buy); ±0.1 and ±0.5 are its own cut-offs
export function signalFor(value: number | null | undefined): Reading {
  if (!isNumber(value)) return { key: 'noData', tone: 'neutral' }
  if (value >= 0.5) return { key: 'strongBuy', tone: 'positive' }
  if (value >= 0.1) return { key: 'buy', tone: 'positive' }
  if (value <= -0.5) return { key: 'strongSell', tone: 'negative' }
  if (value <= -0.1) return { key: 'sell', tone: 'negative' }
  return { key: 'neutral', tone: 'neutral' }
}

// Overbought reads as a warning (negative), oversold as an opportunity (positive)
export function rsiReading(rsi: number | null | undefined): Reading {
  if (!isNumber(rsi) || rsi <= 0) return { key: 'noData', tone: 'neutral' }
  if (rsi >= 70) return { key: 'overbought', tone: 'negative' }
  if (rsi <= 30) return { key: 'oversold', tone: 'positive' }
  return { key: 'neutral', tone: 'neutral' }
}

export function macdReading(macd: number | null | undefined, signal: number | null | undefined): Reading {
  if (!isNumber(macd) || !isNumber(signal)) return { key: 'noData', tone: 'neutral' }
  if (macd > signal) return { key: 'bullishAboveSignal', tone: 'positive' }
  if (macd < signal) return { key: 'bearishBelowSignal', tone: 'negative' }
  return { key: 'neutral', tone: 'neutral' }
}

// ADX measures how strong a trend is, not its direction
export function adxReading(adx: number | null | undefined): Reading {
  if (!isNumber(adx) || adx <= 0) return { key: 'noData', tone: 'neutral' }
  if (adx >= 25) return { key: 'strongTrend', tone: 'neutral' }
  if (adx < 20) return { key: 'noDefinedTrend', tone: 'neutral' }
  return { key: 'moderateTrend', tone: 'neutral' }
}

// 0 at the low, 100 at the high; null when the range is unknown or degenerate
export function rangePosition(value: number, low: number | null | undefined, high: number | null | undefined): number | null {
  if (!isNumber(low) || !isNumber(high) || !isNumber(value) || high <= low) return null
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100))
}

export interface AverageComparison {
  label: string
  value: number
  // Percent distance of the price from the average (positive: price above it)
  distancePct: number
}

// Compares the price with each moving average; entries without a value are dropped
export function compareWithAverages(price: number, averages: { label: string; value: number | null | undefined }[]): AverageComparison[] {
  return averages.flatMap((average) =>
    isNumber(average.value) && average.value > 0
      ? [{ label: average.label, value: average.value, distancePct: ((price - average.value) / average.value) * 100 }]
      : []
  )
}
