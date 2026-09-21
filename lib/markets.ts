import { unstable_cache } from 'next/cache'

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

const ASSETS: { symbol: string; category: string }[] = [
  // Crypto
  { symbol: 'BINANCE:BTCUSDT', category: 'crypto' },
  { symbol: 'BINANCE:ETHUSDT', category: 'crypto' },
  { symbol: 'BINANCE:SOLUSDT', category: 'crypto' },
  { symbol: 'BINANCE:BNBUSDT', category: 'crypto' },
  { symbol: 'BINANCE:XRPUSDT', category: 'crypto' },
  { symbol: 'BINANCE:ADAUSDT', category: 'crypto' },
  { symbol: 'BINANCE:DOGEUSDT', category: 'crypto' },
  { symbol: 'BINANCE:DOTUSDT', category: 'crypto' },
  { symbol: 'BINANCE:AVAXUSDT', category: 'crypto' },
  { symbol: 'BINANCE:LINKUSDT', category: 'crypto' },
  { symbol: 'BINANCE:MATICUSDT', category: 'crypto' },
  { symbol: 'BINANCE:UNIUSDT', category: 'crypto' },
  { symbol: 'BINANCE:ATOMUSDT', category: 'crypto' },
  { symbol: 'BINANCE:LTCUSDT', category: 'crypto' },
  { symbol: 'BINANCE:NEARUSDT', category: 'crypto' },
  // Forex
  { symbol: 'FX:EURUSD', category: 'forex' },
  { symbol: 'FX:GBPUSD', category: 'forex' },
  { symbol: 'FX:USDJPY', category: 'forex' },
  { symbol: 'FX:USDCHF', category: 'forex' },
  { symbol: 'FX:AUDUSD', category: 'forex' },
  { symbol: 'FX:USDCAD', category: 'forex' },
  { symbol: 'FX:NZDUSD', category: 'forex' },
  { symbol: 'FX:EURGBP', category: 'forex' },
  { symbol: 'FX:EURJPY', category: 'forex' },
  { symbol: 'FX:GBPJPY', category: 'forex' },
  // Commodities
  { symbol: 'COMEX:XAUUSD', category: 'commodity' },
  { symbol: 'COMEX:XAGUSD', category: 'commodity' },
  { symbol: 'NYMEX:CL', category: 'commodity' },
  { symbol: 'NYMEX:NG', category: 'commodity' },
  { symbol: 'LME:HG', category: 'commodity' },
  { symbol: 'CBOT:ZC', category: 'commodity' },
  { symbol: 'CBOT:ZW', category: 'commodity' },
  { symbol: 'ICE:SB', category: 'commodity' },
  { symbol: 'ICE:KC', category: 'commodity' },
  { symbol: 'COMEX:PL', category: 'commodity' },
  { symbol: 'COMEX:PA', category: 'commodity' },
  // Stocks - US
  { symbol: 'NASDAQ:AAPL', category: 'stock' },
  { symbol: 'NASDAQ:NVDA', category: 'stock' },
  { symbol: 'NASDAQ:MSFT', category: 'stock' },
  { symbol: 'NASDAQ:GOOGL', category: 'stock' },
  { symbol: 'NASDAQ:AMZN', category: 'stock' },
  { symbol: 'NASDAQ:META', category: 'stock' },
  { symbol: 'NASDAQ:TSLA', category: 'stock' },
  { symbol: 'NASDAQ:AMD', category: 'stock' },
  { symbol: 'NASDAQ:NFLX', category: 'stock' },
  { symbol: 'NASDAQ:INTC', category: 'stock' },
  { symbol: 'NYSE:JPM', category: 'stock' },
  { symbol: 'NYSE:V', category: 'stock' },
  { symbol: 'NYSE:JNJ', category: 'stock' },
  { symbol: 'NYSE:WMT', category: 'stock' },
  { symbol: 'NYSE:UNH', category: 'stock' },
  // Indices
  { symbol: 'SP:SPX', category: 'index' },
  { symbol: 'DJI', category: 'index' },
  { symbol: 'NASDAQ:NDX', category: 'index' },
  { symbol: 'TVC:DXY', category: 'index' },
  { symbol: 'TVC:US10Y', category: 'index' },
  { symbol: 'TVC:US02Y', category: 'index' },
  { symbol: 'TVC:DAX', category: 'index' },
  { symbol: 'TVC:NIKKEI', category: 'index' },
  { symbol: 'TVC:HSI', category: 'index' },
  { symbol: 'TVC:FTSE', category: 'index' },
]

export interface MarketItem {
  symbol: string
  name: string
  description: string
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

async function fetchBatch(batch: { symbol: string; category: string }[]): Promise<MarketItem[]> {
  const payload = {
    columns: MARKET_COLUMNS,
    symbols: { tickers: batch.map((a) => a.symbol) },
    options: { lang: 'en' },
    sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
    range: [0, batch.length],
  }

  const response = await fetch(TRADINGVIEW_SCANNER, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`TradingView batch error: ${response.status}`)

  const result = await response.json()
  const symbolToAsset = new Map(batch.map((a) => [a.symbol, a]))
  const items: MarketItem[] = []

  for (const item of (result.data ?? []) as { s: string; d: unknown[] }[]) {
    const assetDef = symbolToAsset.get(item.s)
    if (!assetDef || !item) continue

        const d = item.d as unknown[]
        items.push({
          symbol: assetDef.symbol,
          name: (d[0] as string) || assetDef.symbol.split(':').pop() || '',
          description: (d[1] as string) || '',
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
  const batches: (typeof ASSETS)[] = []
  for (let i = 0; i < ASSETS.length; i += BATCH_SIZE) batches.push(ASSETS.slice(i, i + BATCH_SIZE))

  const results = await Promise.allSettled(batches.map(fetchBatch))
  return results.flatMap((result) => {
    if (result.status === 'rejected') {
      console.error('Markets batch failed:', result.reason)
      return []
    }
    return result.value
  })
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
