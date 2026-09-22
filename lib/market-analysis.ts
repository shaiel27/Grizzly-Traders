export type Tone = 'positive' | 'negative' | 'neutral'

export interface Reading {
  label: string
  tone: Tone
}

const isNumber = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)

// TradingView's summary rating runs from -1 (strong sell) to +1 (strong buy); ±0.1 and ±0.5 are its own cut-offs
export function signalFor(value: number | null | undefined): Reading {
  if (!isNumber(value)) return { label: 'Sin datos', tone: 'neutral' }
  if (value >= 0.5) return { label: 'Compra fuerte', tone: 'positive' }
  if (value >= 0.1) return { label: 'Compra', tone: 'positive' }
  if (value <= -0.5) return { label: 'Venta fuerte', tone: 'negative' }
  if (value <= -0.1) return { label: 'Venta', tone: 'negative' }
  return { label: 'Neutral', tone: 'neutral' }
}

// Overbought reads as a warning (negative), oversold as an opportunity (positive)
export function rsiReading(rsi: number | null | undefined): Reading {
  if (!isNumber(rsi) || rsi <= 0) return { label: 'Sin datos', tone: 'neutral' }
  if (rsi >= 70) return { label: 'Sobrecompra', tone: 'negative' }
  if (rsi <= 30) return { label: 'Sobreventa', tone: 'positive' }
  return { label: 'Neutral', tone: 'neutral' }
}

export function macdReading(macd: number | null | undefined, signal: number | null | undefined): Reading {
  if (!isNumber(macd) || !isNumber(signal)) return { label: 'Sin datos', tone: 'neutral' }
  if (macd > signal) return { label: 'Alcista: sobre su señal', tone: 'positive' }
  if (macd < signal) return { label: 'Bajista: bajo su señal', tone: 'negative' }
  return { label: 'Neutral', tone: 'neutral' }
}

// ADX measures how strong a trend is, not its direction
export function adxReading(adx: number | null | undefined): Reading {
  if (!isNumber(adx) || adx <= 0) return { label: 'Sin datos', tone: 'neutral' }
  if (adx >= 25) return { label: 'Tendencia fuerte', tone: 'neutral' }
  if (adx < 20) return { label: 'Sin tendencia definida', tone: 'neutral' }
  return { label: 'Tendencia moderada', tone: 'neutral' }
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
