import { unstable_cache } from 'next/cache'
import { scanTradingView, type ScannerRow } from './markets'
import { PIVOT_ASSETS } from './pivot-assets'
import type { PivotQuote, PivotTimeframe } from './pivot-types'

export { PIVOT_TIMEFRAMES, isPivotTimeframe } from './pivot-types'
export type { PivotQuote, PivotTimeframe } from './pivot-types'


// The scanner's own Pivot.M.* columns are MONTHLY pivots whatever the timeframe, so levels are computed
// here from the previous period's OHLC instead ([1] is one bar back, |1W and |1M pick the bar size).
const TIMEFRAME_SUFFIX: Record<PivotTimeframe, string> = { D: '', W: '|1W', M: '|1M' }

export function pivotColumns(timeframe: PivotTimeframe): string[] {
  const suffix = TIMEFRAME_SUFFIX[timeframe]
  return [
    'name',
    'description',
    'close',
    'change',
    'change_abs',
    `open[1]${suffix}`,
    `high[1]${suffix}`,
    `low[1]${suffix}`,
    `close[1]${suffix}`,
  ]
}

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

// Rows come back in the scanner's order; results follow the catalog order. Rows with unusable data are dropped.
export function mapPivotRows(rows: ScannerRow[]): PivotQuote[] {
  const byTicker = new Map(rows.map((row) => [row.s, row.d]))

  return PIVOT_ASSETS.flatMap((asset): PivotQuote[] => {
    const d = byTicker.get(asset.tv)
    if (!d) return []

    const [ticker, description, price, change, changeAbs, open, high, low, close] = d
    if (!isPositive(price) || !isPositive(high) || !isPositive(low) || !isPositive(close) || high < low) return []

    return [
      {
        symbol: asset.tv,
        ticker: typeof ticker === 'string' ? ticker : asset.tv,
        description: typeof description === 'string' ? description : asset.name,
        price,
        change: typeof change === 'number' ? change : 0,
        changeAbs: typeof changeAbs === 'number' ? changeAbs : 0,
        // DeMark needs the open; falling back to the close makes it behave like a flat session
        previous: { open: isPositive(open) ? open : close, high, low, close },
      },
    ]
  })
}

export async function fetchPivotQuotes(timeframe: PivotTimeframe): Promise<PivotQuote[]> {
  const rows = await scanTradingView(
    PIVOT_ASSETS.map((asset) => asset.tv),
    pivotColumns(timeframe)
  )
  return mapPivotRows(rows)
}

function cachedQuotes(timeframe: PivotTimeframe) {
  return unstable_cache(
    async () => {
      const quotes = await fetchPivotQuotes(timeframe)
      // An empty result must not be cached, otherwise one bad moment sticks around
      if (quotes.length === 0) throw new Error('No pivot data')
      return quotes
    },
    ['pivot-quotes', timeframe],
    { revalidate: 15, tags: ['pivots'] }
  )
}

const cachedByTimeframe = { D: cachedQuotes('D'), W: cachedQuotes('W'), M: cachedQuotes('M') }

export function getPivotQuotes(timeframe: PivotTimeframe): Promise<PivotQuote[]> {
  return cachedByTimeframe[timeframe]()
}
