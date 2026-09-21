import { unstable_cache } from 'next/cache'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1'
const FINNHUB_BASE = 'https://finnhub.io/api/v1'

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? ''

const REQUEST_TIMEOUT_MS = 8_000

async function fetchJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Absolute move implied by a percentage change against the current price
function absoluteChange(price: number, percent: number): number {
  return price - price / (1 + percent / 100)
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

export interface PriceData {
  symbol: string
  price: number
  change24h: number
  changePercent24h: number
  source: string
  timestamp: number
}

// CoinGecko: Crypto + Gold (pax-gold tracks XAU/USD)
async function fetchCoinGeckoPrices(): Promise<PriceData[]> {
  try {
    const data = await fetchJson(
      `${COINGECKO_BASE}/simple/price?ids=bitcoin,ethereum,solana,pax-gold&vs_currencies=usd&include_24hr_change=true`
    )
    const now = Date.now()

    const coins: [string, string][] = [
      ['BTC', 'bitcoin'],
      ['ETH', 'ethereum'],
      ['SOL', 'solana'],
      ['XAUUSD', 'pax-gold'],
    ]

    return coins.flatMap(([symbol, id]) => {
      const price = data[id]?.usd
      if (typeof price !== 'number' || price <= 0) return []
      const percent = data[id]?.usd_24h_change ?? 0
      return [
        {
          symbol,
          price,
          change24h: absoluteChange(price, percent),
          changePercent24h: percent,
          source: 'coingecko',
          timestamp: now,
        },
      ]
    })
  } catch (error) {
    console.error('CoinGecko prices failed, using Yahoo fallback:', error)
    return fetchYahooFallbackPrices()
  }
}

// Used when CoinGecko rate-limits (HTTP 429): same assets from Yahoo's chart endpoint (gold as futures)
const YAHOO_FALLBACK: [string, string][] = [
  ['BTC', 'BTC-USD'],
  ['ETH', 'ETH-USD'],
  ['SOL', 'SOL-USD'],
  ['XAUUSD', 'GC=F'],
]

async function fetchYahooFallbackPrices(): Promise<PriceData[]> {
  const results = await Promise.allSettled(
    YAHOO_FALLBACK.map(async ([symbol, yahooSymbol]): Promise<PriceData | null> => {
      const data = await fetchJson(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
      )
      const meta = data?.chart?.result?.[0]?.meta
      const price = meta?.regularMarketPrice
      const previous = meta?.chartPreviousClose
      if (typeof price !== 'number' || price <= 0) return null
      const change = typeof previous === 'number' && previous > 0 ? price - previous : 0
      return {
        symbol,
        price,
        change24h: change,
        changePercent24h: typeof previous === 'number' && previous > 0 ? (change / previous) * 100 : 0,
        source: 'yahoo',
        timestamp: Date.now(),
      }
    })
  )
  return results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []))
}

// Frankfurter: Forex rates (free, no key, ECB reference rates published once per business day)
async function fetchForexPair(base: 'EUR' | 'GBP', symbol: string): Promise<PriceData | null> {
  const data = await fetchJson(`${FRANKFURTER_BASE}/${isoDaysAgo(7)}..?from=${base}&to=USD`)
  const days = Object.keys(data.rates ?? {}).sort()
  const latest: number | undefined = data.rates?.[days[days.length - 1]]?.USD
  const previous: number | undefined = data.rates?.[days[days.length - 2]]?.USD

  if (typeof latest !== 'number' || latest <= 0) return null

  const change = typeof previous === 'number' && previous > 0 ? latest - previous : 0
  return {
    symbol,
    price: latest,
    change24h: change,
    changePercent24h: typeof previous === 'number' && previous > 0 ? (change / previous) * 100 : 0,
    source: 'frankfurter',
    timestamp: Date.now(),
  }
}

async function fetchForexPrices(): Promise<PriceData[]> {
  const results = await Promise.allSettled([fetchForexPair('EUR', 'EURUSD'), fetchForexPair('GBP', 'GBPUSD')])

  return results.flatMap((result) => {
    if (result.status === 'rejected') {
      console.error('Forex prices failed:', result.reason)
      return []
    }
    return result.value ? [result.value] : []
  })
}

// Finnhub: Stocks + DXY (via ETF proxies)
async function fetchFinnhubPrices(): Promise<PriceData[]> {
  if (!FINNHUB_API_KEY) return []

  // SPY and UUP are ETF proxies for the S&P 500 and the Dollar Index; their values are scaled, not official index levels
  const symbols = ['AAPL', 'NVDA', 'SPY', 'UUP']
  const symbolMap: Record<string, string> = {
    AAPL: 'AAPL',
    NVDA: 'NVDA',
    SPY: 'SPX',
    UUP: 'DXY',
  }

  // Conversion factors for ETF proxies
  const ETF_FACTORS: Record<string, number> = {
    SPX: 10.09,
    DXY: 3.71,
  }

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const data = await fetchJson(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`)
        const mappedSymbol = symbolMap[symbol] ?? symbol
        const factor = ETF_FACTORS[mappedSymbol] ?? 1

        return {
          symbol: mappedSymbol,
          price: (data.c ?? 0) * factor,
          change24h: (data.d ?? 0) * factor,
          changePercent24h: data.dp ?? 0,
          source: 'finnhub',
          timestamp: Date.now(),
        }
      })
    )

    return results.filter((r): r is PriceData => r !== null && r.price > 0)
  } catch (error) {
    console.error('Finnhub prices failed:', error)
    return []
  }
}

// Last valid price per symbol, so one provider having a bad minute doesn't blank part of the ticker
const STALE_LIMIT_MS = 15 * 60 * 1000
const lastGood = new Map<string, PriceData>()

// Main function to fetch all prices from all sources
export async function fetchAllPrices(): Promise<PriceData[]> {
  const [coinGeckoPrices, forexPrices, finnhubPrices] = await Promise.all([
    fetchCoinGeckoPrices(),
    fetchForexPrices(),
    fetchFinnhubPrices(),
  ])

  // Merge all prices, later sources take precedence
  const priceMap = new Map<string, PriceData>()

  for (const price of [...coinGeckoPrices, ...forexPrices, ...finnhubPrices]) {
    priceMap.set(price.symbol, price)
  }

  const now = Date.now()
  for (const price of priceMap.values()) lastGood.set(price.symbol, price)
  for (const [symbol, price] of lastGood) {
    if (!priceMap.has(symbol) && now - price.timestamp < STALE_LIMIT_MS) priceMap.set(symbol, price)
  }

  return Array.from(priceMap.values())
}

// Shared server-side snapshot (layout and API): stale data is served while it refreshes in the background
export const getCachedPrices = unstable_cache(
  async () => {
    const prices = await fetchAllPrices()
    // Never cache an empty snapshot: throwing keeps the previous good value in place
    if (prices.length === 0) throw new Error('No prices available')
    return prices
  },
  ['prices'],
  { revalidate: 30, tags: ['prices'] }
)
