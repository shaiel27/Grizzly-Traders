// Client-safe: nothing here may import server-only modules (next/cache, the scanner client...)

export type PivotTimeframe = 'D' | 'W' | 'M'

export const PIVOT_TIMEFRAMES: { key: PivotTimeframe; label: string; period: string }[] = [
  { key: 'D', label: 'Diario', period: 'sesión anterior' },
  { key: 'W', label: 'Semanal', period: 'semana anterior' },
  { key: 'M', label: 'Mensual', period: 'mes anterior' },
]

export function isPivotTimeframe(value: string): value is PivotTimeframe {
  return value === 'D' || value === 'W' || value === 'M'
}

export interface PivotQuote {
  // TradingView ticker, the key into PIVOT_ASSETS
  symbol: string
  ticker: string
  description: string
  price: number
  // Percent change of the current session
  change: number
  changeAbs: number
  previous: { open: number; high: number; low: number; close: number }
}
