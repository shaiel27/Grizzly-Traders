import { unstable_cache } from 'next/cache'
import { scanTradingView, type ScannerRow } from './markets'
import { getCachedPrices, type PriceData } from './prices'

export interface TickerQuote {
  symbol: string
  label: string
  price: number
  changePercent: number | null
  currency: boolean
}

export interface TickerSnapshot {
  quotes: TickerQuote[]
  updatedAt: number
}

interface TickerAsset {
  // Matches PriceData.symbol so the fallback provider can fill in when the scanner misses an asset
  symbol: string
  label: string
  tv: string
  // Forex pairs and indices are quoted in points, not dollars
  currency: boolean
}

// Interleaved on purpose: every stretch of the scrolling bar mixes asset classes
const TICKER_ASSETS: TickerAsset[] = [
  { symbol: 'BTC', label: 'BTC/USD', tv: 'BINANCE:BTCUSDT', currency: true },
  { symbol: 'EURUSD', label: 'EUR/USD', tv: 'FX:EURUSD', currency: false },
  { symbol: 'SPX', label: 'S&P 500', tv: 'SP:SPX', currency: false },
  { symbol: 'XAUUSD', label: 'XAU/USD', tv: 'OANDA:XAUUSD', currency: true },
  { symbol: 'AAPL', label: 'AAPL', tv: 'NASDAQ:AAPL', currency: true },
  { symbol: 'ETH', label: 'ETH/USD', tv: 'BINANCE:ETHUSDT', currency: true },
  { symbol: 'GBPUSD', label: 'GBP/USD', tv: 'FX:GBPUSD', currency: false },
  { symbol: 'NDX', label: 'NASDAQ 100', tv: 'NASDAQ:NDX', currency: false },
  { symbol: 'BRENT', label: 'BRENT', tv: 'ICEEUR:BRN1!', currency: true },
  { symbol: 'WTI', label: 'WTI', tv: 'NYMEX:CL1!', currency: true },
  { symbol: 'NVDA', label: 'NVDA', tv: 'NASDAQ:NVDA', currency: true },
  { symbol: 'SOL', label: 'SOL/USD', tv: 'BINANCE:SOLUSDT', currency: true },
  { symbol: 'USDJPY', label: 'USD/JPY', tv: 'FX:USDJPY', currency: false },
  { symbol: 'DJI', label: 'DOW JONES', tv: 'TVC:DJI', currency: false },
  { symbol: 'XAGUSD', label: 'XAG/USD', tv: 'TVC:SILVER', currency: true },
  { symbol: 'TSLA', label: 'TSLA', tv: 'NASDAQ:TSLA', currency: true },
  { symbol: 'BNB', label: 'BNB/USD', tv: 'BINANCE:BNBUSDT', currency: true },
  { symbol: 'DXY', label: 'DXY', tv: 'TVC:DXY', currency: false },
  { symbol: 'AUDUSD', label: 'AUD/USD', tv: 'FX:AUDUSD', currency: false },
  { symbol: 'DAX', label: 'DAX', tv: 'TVC:DEU40', currency: false },
  { symbol: 'MSFT', label: 'MSFT', tv: 'NASDAQ:MSFT', currency: true },
  { symbol: 'XRP', label: 'XRP/USD', tv: 'BINANCE:XRPUSDT', currency: true },
  { symbol: 'NG', label: 'GAS NAT.', tv: 'NYMEX:NG1!', currency: true },
  { symbol: 'USDCAD', label: 'USD/CAD', tv: 'FX:USDCAD', currency: false },
  { symbol: 'NIKKEI', label: 'NIKKEI', tv: 'TVC:NI225', currency: false },
  { symbol: 'AMZN', label: 'AMZN', tv: 'NASDAQ:AMZN', currency: true },
  { symbol: 'ADA', label: 'ADA/USD', tv: 'BINANCE:ADAUSDT', currency: true },
  { symbol: 'FTSE', label: 'FTSE 100', tv: 'TVC:UKX', currency: false },
  { symbol: 'USDCHF', label: 'USD/CHF', tv: 'FX:USDCHF', currency: false },
  { symbol: 'META', label: 'META', tv: 'NASDAQ:META', currency: true },
  { symbol: 'DOGE', label: 'DOGE/USD', tv: 'BINANCE:DOGEUSDT', currency: true },
  { symbol: 'VIX', label: 'VIX', tv: 'TVC:VIX', currency: false },
  { symbol: 'GOOGL', label: 'GOOGL', tv: 'NASDAQ:GOOGL', currency: true },
  { symbol: 'AVAX', label: 'AVAX/USD', tv: 'BINANCE:AVAXUSDT', currency: true },
  { symbol: 'LINK', label: 'LINK/USD', tv: 'BINANCE:LINKUSDT', currency: true },
]

const SCANNER_COLUMNS = ['close', 'change']

// Live scanner quotes win; the price providers only cover assets the scanner did not return
export function buildTickerQuotes(rows: ScannerRow[], prices: PriceData[]): TickerQuote[] {
  const scanned = new Map(rows.map((row) => [row.s, row.d]))
  const fallback = new Map(prices.map((price) => [price.symbol, price]))

  return TICKER_ASSETS.flatMap((asset): TickerQuote[] => {
    const [close, change] = scanned.get(asset.tv) ?? []

    if (typeof close === 'number' && close > 0) {
      return [
        {
          symbol: asset.symbol,
          label: asset.label,
          price: close,
          changePercent: typeof change === 'number' ? change : null,
          currency: asset.currency,
        },
      ]
    }

    const backup = fallback.get(asset.symbol)
    if (!backup || !(backup.price > 0)) return []
    return [
      {
        symbol: asset.symbol,
        label: asset.label,
        price: backup.price,
        changePercent: typeof backup.changePercent24h === 'number' ? backup.changePercent24h : null,
        currency: asset.currency,
      },
    ]
  })
}

async function fetchTickerSnapshot(): Promise<TickerSnapshot> {
  const rows = await scanTradingView(
    TICKER_ASSETS.map((asset) => asset.tv),
    SCANNER_COLUMNS
  ).catch((error): ScannerRow[] => {
    console.error('Ticker scanner failed, using price providers only:', error)
    return []
  })

  // The slower providers are only worth a lookup when the scanner left assets uncovered
  const covered = buildTickerQuotes(rows, []).length
  const prices = covered < TICKER_ASSETS.length ? await getCachedPrices().catch((): PriceData[] => []) : []

  return { quotes: buildTickerQuotes(rows, prices), updatedAt: Date.now() }
}

async function fetchNonEmptySnapshot(): Promise<TickerSnapshot> {
  const snapshot = await fetchTickerSnapshot()
  // An empty bar is never worth serving or caching
  if (snapshot.quotes.length === 0) throw new Error('No ticker quotes available')
  return snapshot
}

// First paint (layout). Revalidating this often would also regenerate every static page that renders the
// header, so it stays slow: the client polls /api/ticker as soon as it mounts.
export const getTickerSnapshot = unstable_cache(fetchNonEmptySnapshot, ['ticker'], {
  revalidate: 15,
  tags: ['ticker'],
})

// Shorter than the 3 s client interval, so every poll finds the snapshot expired and gets fresh quotes
export const LIVE_TTL_MS = 2_000
// Keep serving the last good quotes through a short provider outage instead of blanking the bar
export const LIVE_MAX_STALE_MS = 60_000

let lastSnapshot: TickerSnapshot | null = null
let inflight: Promise<TickerSnapshot> | null = null

// Polling endpoint: at most one upstream request per TTL per server instance, shared by every visitor
export async function getLiveTickerSnapshot(): Promise<TickerSnapshot> {
  if (lastSnapshot && Date.now() - lastSnapshot.updatedAt < LIVE_TTL_MS) return lastSnapshot

  inflight ??= fetchNonEmptySnapshot()
    .then((snapshot) => {
      lastSnapshot = snapshot
      return snapshot
    })
    .finally(() => {
      inflight = null
    })

  try {
    return await inflight
  } catch (error) {
    if (lastSnapshot && Date.now() - lastSnapshot.updatedAt < LIVE_MAX_STALE_MS) return lastSnapshot
    throw error
  }
}
