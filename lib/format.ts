// Single place to change how prices and figures are written across the site
export const NUMBER_LOCALE = 'en-US'

const FOREX_3_DECIMALS = ['USDJPY', 'USDCHF', 'USDCAD', 'EURGBP', 'EURJPY', 'GBPJPY']
const FOREX_5_DECIMALS = ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD']

interface PriceOptions {
  // Prefix the value with $ (forex pairs never get one)
  currency?: boolean
  // Decimals for the majors quoted to 5 places; tight layouts can pass 4
  forexDecimals?: number
}

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value)
}

// `symbol` is matched by substring, so both "EURUSD" and "FX:EURUSD" work
export function formatPrice(value: number | null | undefined, symbol = '', options: PriceOptions = {}): string {
  if (isMissing(value)) return '—'
  const { currency = false, forexDecimals = 5 } = options

  if (FOREX_3_DECIMALS.some((pair) => symbol.includes(pair))) return value.toFixed(3)
  if (FOREX_5_DECIMALS.some((pair) => symbol.includes(pair))) return value.toFixed(forexDecimals)

  const prefix = currency ? '$' : ''
  if (value >= 1000) {
    return prefix + value.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  // Sub-dollar assets (DOGE, ADA...) need more digits or every move rounds to the same value
  if (value > 0 && value < 1) return prefix + value.toFixed(4)
  return prefix + value.toFixed(2)
}

// Billions and millions are abbreviated with a $ prefix; anything smaller is a plain grouped number
export function formatNumber(value: number | null | undefined, decimals = 2, compactDecimals = 2): string {
  if (isMissing(value)) return '—'
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(compactDecimals)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(compactDecimals)}M`
  return value.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Trading volume and similar counts: 1.23B, 4.5M, 12.3K
export function formatCompact(value: number | null | undefined): string {
  if (isMissing(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

// Pivot levels are derived numbers with no tick size of their own, so precision follows the price magnitude
export function formatLevel(value: number, reference: number, symbol = ''): string {
  if (isMissing(value)) return '—'
  if ([...FOREX_3_DECIMALS, ...FOREX_5_DECIMALS].some((pair) => symbol.includes(pair))) return formatPrice(value, symbol)

  const decimals = reference >= 100 ? 2 : reference >= 10 ? 3 : reference >= 1 ? 4 : 5
  return value.toLocaleString(NUMBER_LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
