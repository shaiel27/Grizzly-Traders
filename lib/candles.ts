export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export const RANGES = {
  '1D': { interval: '5m', range: '1d' },
  '5D': { interval: '30m', range: '5d' },
  '1M': { interval: '1d', range: '1mo' },
  '6M': { interval: '1d', range: '6mo' },
  '1Y': { interval: '1wk', range: '1y' },
} as const

export type RangeKey = keyof typeof RANGES

const FIXED_MAP: Record<string, string> = {
  'COMEX:XAUUSD': 'GC=F',
  'COMEX:XAGUSD': 'SI=F',
  'COMEX:PL': 'PL=F',
  'COMEX:PA': 'PA=F',
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
      indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] }
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
    const open = quote.open[i]
    const high = quote.high[i]
    const low = quote.low[i]
    const close = quote.close[i]
    if (open == null || high == null || low == null || close == null) continue
    candles.push({ time: times[i], open, high, low, close })
  }
  return candles
}
