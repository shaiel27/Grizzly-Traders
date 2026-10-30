import { unstable_cache } from 'next/cache'
import { ASSET_BY_PLAIN, type AssetDefinition } from './assets-catalog'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1'
const FINNHUB_BASE = 'https://finnhub.io/api/v1'

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? ''

const REQUEST_TIMEOUT_MS = 8_000

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`)
  }
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new HttpError(response.status)
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

// CoinGecko's free tier rate-limits aggressively; once we hit a 429 we stop knocking for a while
// instead of retrying every call and piling up more 429s while the window resets.
const COINGECKO_COOLDOWN_MS = 60_000
let coinGeckoCooldownUntil = 0

// CoinGecko: Crypto + Gold (pax-gold tracks XAU/USD)
async function fetchCoinGeckoPrices(): Promise<PriceData[]> {
  if (Date.now() < coinGeckoCooldownUntil) return fetchYahooFallbackPrices()

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
    // A 429 is CoinGecko's normal free-tier behavior, not a bug — the Yahoo fallback covers it,
    // so this is a warning, not an error, and it earns a cooldown so we stop asking for a while.
    if (error instanceof HttpError && error.status === 429) {
      coinGeckoCooldownUntil = Date.now() + COINGECKO_COOLDOWN_MS
      console.warn('CoinGecko rate-limited (429); pausing 60s and using Yahoo fallback')
    } else {
      console.warn('CoinGecko prices failed, using Yahoo fallback:', error)
    }
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

// SPX y DXY se sirven como indices REALES desde Yahoo (SPX -> ^GSPC, DXY -> DX-Y.NYB, simbolos del
// campo `yahoo` de lib/assets-catalog.ts). Antes venian de Finnhub como ETF proxy (SPY/UUP
// multiplicados por un factor fijo: 10.09 / 3.71), un valor sintetico que se desvia del nivel real
// del indice cada dia. Verificado en vivo contra Yahoo (2026-10-09): ^GSPC y DX-Y.NYB responden
// con el nivel oficial.
const INDEX_QUOTES = (['SPX', 'DXY'] as const)
  .map((plain) => {
    const asset: AssetDefinition | undefined = ASSET_BY_PLAIN.get(plain)
    return asset?.yahoo ? ([plain, asset.yahoo] as [string, string]) : null
  })
  .filter((entry): entry is [string, string] => entry !== null)

// Yahoo chart endpoint: devuelve el precio vivo + el cierre anterior, de donde sale el % del dia
async function fetchYahooQuote(yahooSymbol: string, plain: string): Promise<PriceData | null> {
  const data = await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
  )
  const meta = data?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  const previous = meta?.chartPreviousClose
  if (typeof price !== 'number' || price <= 0) return null
  const change = typeof previous === 'number' && previous > 0 ? price - previous : 0
  return {
    symbol: plain,
    price,
    change24h: change,
    changePercent24h: typeof previous === 'number' && previous > 0 ? (change / previous) * 100 : 0,
    source: 'yahoo',
    timestamp: Date.now(),
  }
}

// Un fallo por simbolo no enmiola al resto: cada entrada se evalua por separado
async function fetchYahooQuotes(entries: [string, string][]): Promise<PriceData[]> {
  const results = await Promise.allSettled(entries.map(([plain, yahoo]) => fetchYahooQuote(yahoo, plain)))
  return results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []))
}

async function fetchYahooFallbackPrices(): Promise<PriceData[]> {
  return fetchYahooQuotes(YAHOO_FALLBACK)
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
      console.warn('Forex prices failed:', result.reason)
      return []
    }
    return result.value ? [result.value] : []
  })
}

// Finnhub: Stocks (AAPL, NVDA). Los indices SPX/DXY ya no pasan por aca — se sirven de Yahoo
// como ^GSPC/DX-Y.NYB via INDEX_QUOTES; el proxy SPY/UUP x factor derivaba del nivel real a diario.
async function fetchFinnhubPrices(): Promise<PriceData[]> {
  if (!FINNHUB_API_KEY) return []

  const symbols = ['AAPL', 'NVDA']

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const data = await fetchJson(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`)

        return {
          symbol,
          price: (data.c ?? 0),
          change24h: (data.d ?? 0),
          changePercent24h: data.dp ?? 0,
          source: 'finnhub',
          timestamp: Date.now(),
        }
      })
    )

    return results.filter((r): r is PriceData => r !== null && r.price > 0)
  } catch (error) {
    console.warn('Finnhub prices failed:', error)
    return []
  }
}

// Last valid price per symbol, so one provider having a bad minute doesn't blank part of the ticker
const STALE_LIMIT_MS = 15 * 60 * 1000
const lastGood = new Map<string, PriceData>()

// Main function to fetch all prices from all sources
export async function fetchAllPrices(): Promise<PriceData[]> {
  const [coinGeckoPrices, forexPrices, finnhubPrices, indexPrices] = await Promise.all([
    fetchCoinGeckoPrices(),
    fetchForexPrices(),
    fetchFinnhubPrices(),
    fetchYahooQuotes(INDEX_QUOTES),
  ])

  // Merge all prices, later sources take precedence
  const priceMap = new Map<string, PriceData>()

  for (const price of [...coinGeckoPrices, ...forexPrices, ...finnhubPrices, ...indexPrices]) {
    priceMap.set(price.symbol, price)
  }

  const now = Date.now()
  for (const price of priceMap.values()) lastGood.set(price.symbol, price)
  for (const [symbol, price] of lastGood) {
    if (!priceMap.has(symbol) && now - price.timestamp < STALE_LIMIT_MS) priceMap.set(symbol, price)
  }

  return Array.from(priceMap.values())
}

// Shared server-side snapshot (layout and API): stale data is served while it refreshes in the background.
// Sin tags: nadie llama revalidateTag('prices') (el unico flujo de mutacion, revalidateContent,
// cubre posts/catalog) — el revalidate por tiempo es el unico mecanismo de invalidacion.
export const getCachedPrices = unstable_cache(
  async () => {
    const prices = await fetchAllPrices()
    // Never cache an empty snapshot: throwing keeps the previous good value in place
    if (prices.length === 0) throw new Error('No prices available')
    return prices
  },
  ['prices'],
  { revalidate: 30 }
)
