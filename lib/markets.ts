import { unstable_cache } from 'next/cache'
import { MARKET_ASSETS, type MarketAssetDef } from './market-assets'

const TRADINGVIEW_SCANNER = 'https://scanner.tradingview.com/global/scan'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  'Origin': 'https://es.tradingview.com',
  'Referer': 'https://es.tradingview.com/',
  'Content-Type': 'application/json',
}

const MARKET_COLUMNS = [
  'name', 'description', 'type', 'close', 'open', 'high', 'low',
  'change', 'change_abs', 'volume',
  'market_cap_basic', 'price_52_week_high', 'price_52_week_low',
  'RSI', 'MACD.macd', 'MACD.signal', 'ADX', 'ATR',
  'Recommend.All', 'Recommend.MA', 'Recommend.Other',
  'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.Y',
  'EMA10', 'EMA20', 'EMA50', 'SMA50', 'SMA200',
  'VWAP', 'beta_1_year',
]

export interface MarketItem {
  symbol: string
  name: string
  description: string
  // English counterpart of `description` (Fase 5 del plan de cobertura en inglés) — consumers
  // pick this instead of `description` when the locale is 'en'; falls back to the same scanner
  // text as `description` for stocks, whose description is already in English either way.
  descriptionEn: string
  category: string
  type: string
  close: number
  open: number
  high: number
  low: number
  change: number
  changeAbs: number
  volume: number
  marketCap: number
  high52w: number
  low52w: number
  rsi: number
  macd: number
  macdSignal: number
  adx: number
  atr: number
  recommendAll: number
  recommendMA: number
  recommendOther: number
  perf1M: number
  perf3M: number
  perf6M: number
  perfY: number
  ema10: number
  ema20: number
  ema50: number
  sma50: number
  sma200: number
  vwap: number
  beta: number
}

const BATCH_SIZE = 30
const REQUEST_TIMEOUT_MS = 10_000

export interface ScannerRow {
  s: string
  d: unknown[]
}

// One scanner request; symbols the scanner doesn't know are simply absent from the result
export async function scanTradingView(tickers: string[], columns: string[]): Promise<ScannerRow[]> {
  const payload = {
    columns,
    symbols: { tickers },
    options: { lang: 'en' },
    sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
    range: [0, tickers.length],
  }

  const response = await fetch(TRADINGVIEW_SCANNER, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`TradingView batch error: ${response.status}`)

  const result = await response.json()
  return (result.data ?? []) as ScannerRow[]
}

async function fetchBatch(batch: MarketAssetDef[]): Promise<MarketItem[]> {
  const rows = await scanTradingView(batch.map((a) => a.symbol), MARKET_COLUMNS)
  const symbolToAsset = new Map(batch.map((a) => [a.symbol, a]))
  const items: MarketItem[] = []

  for (const item of rows) {
    const assetDef = symbolToAsset.get(item.s)
    if (!assetDef || !item) continue

        const d = item.d as unknown[]
        items.push({
          symbol: assetDef.symbol,
          name: assetDef.label || (d[0] as string) || assetDef.symbol.split(':').pop() || '',
          description: assetDef.title || (d[1] as string) || '',
          descriptionEn: assetDef.nameEn || (d[1] as string) || '',
          category: assetDef.category,
          type: (d[2] as string) || '',
          close: d[3] as number,
          open: d[4] as number,
          high: d[5] as number,
          low: d[6] as number,
          change: d[7] as number,
          changeAbs: d[8] as number,
          volume: d[9] as number,
          marketCap: d[10] as number,
          high52w: d[11] as number,
          low52w: d[12] as number,
          rsi: d[13] as number,
          macd: d[14] as number,
          macdSignal: d[15] as number,
          adx: d[16] as number,
          atr: d[17] as number,
          recommendAll: d[18] as number,
          recommendMA: d[19] as number,
          recommendOther: d[20] as number,
          perf1M: d[21] as number,
          perf3M: d[22] as number,
          perf6M: d[23] as number,
          perfY: d[24] as number,
          ema10: d[25] as number,
          ema20: d[26] as number,
          ema50: d[27] as number,
          sma50: d[28] as number,
          sma200: d[29] as number,
          vwap: d[30] as number,
          beta: d[31] as number,
        })
  }

  return items
}

// Batches run in parallel; one failing batch only drops its own assets instead of the whole table.
async function fetchMarketsUncached(): Promise<MarketItem[]> {
  const batches: (typeof MARKET_ASSETS)[] = []
  for (let i = 0; i < MARKET_ASSETS.length; i += BATCH_SIZE) batches.push(MARKET_ASSETS.slice(i, i + BATCH_SIZE))

  const results = await Promise.allSettled(batches.map(fetchBatch))
  const items = results.flatMap((result) => {
    if (result.status === 'rejected') {
      console.error('Markets batch failed:', result.reason)
      return []
    }
    return result.value
  })

  // The scanner answers by market cap; keep the catalog order so the terminal is stable between refreshes
  const order = new Map(MARKET_ASSETS.map((asset, index) => [asset.symbol, index]))
  return items.sort((a, b) => (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0))
}

export const getMarkets = unstable_cache(
  async () => {
    const markets = await fetchMarketsUncached()
    // An empty result must not be cached, otherwise one bad minute sticks around
    if (markets.length === 0) throw new Error('No market data')
    return markets
  },
  ['markets'],
  { revalidate: 60, tags: ['markets'] }
)
