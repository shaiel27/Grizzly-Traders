import { unstable_cache } from 'next/cache'

const TRADINGVIEW_SCANNER = 'https://scanner.tradingview.com/global/scan'
const REQUEST_TIMEOUT_MS = 10_000

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
  Origin: 'https://es.tradingview.com',
  Referer: 'https://es.tradingview.com/',
  'Content-Type': 'application/json',
}

const PIVOT_COLUMNS = [
  'name', 'description', 'close', 'open', 'high', 'low',
  'change', 'change_abs', 'volume',
  'Pivot.M.Classic.Middle',
  'Pivot.M.Classic.S1', 'Pivot.M.Classic.S2', 'Pivot.M.Classic.S3',
  'Pivot.M.Classic.R1', 'Pivot.M.Classic.R2', 'Pivot.M.Classic.R3',
  'Pivot.M.Fibonacci.S1', 'Pivot.M.Fibonacci.R1',
  'Pivot.M.Camarilla.S1', 'Pivot.M.Camarilla.R1',
  'Pivot.M.Woodie.S1', 'Pivot.M.Woodie.R1',
  'Pivot.M.DM.S1', 'Pivot.M.DM.R1',
]

export const DEFAULT_PIVOT_SYMBOLS = [
  'BINANCE:BTCUSDT',
  'BINANCE:ETHUSDT',
  'BINANCE:SOLUSDT',
  'FX:EURUSD',
  'FX:GBPUSD',
  'COMEX:XAUUSD',
  'NASDAQ:AAPL',
  'NASDAQ:NVDA',
  'SP:SPX',
  'TVC:DXY',
]

export interface PivotData {
  symbol: string
  description: string
  close: number
  open: number
  high: number
  low: number
  change: number
  changeAbs: number
  volume: number
  classic: { pivot: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }
  fibonacci: { s1: number; r1: number }
  camarilla: { s1: number; r1: number }
  woodie: { s1: number; r1: number }
  demark: { s1: number; r1: number }
}

export async function fetchPivotData(symbols: string[]): Promise<PivotData[]> {
  const response = await fetch(TRADINGVIEW_SCANNER, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      columns: PIVOT_COLUMNS,
      symbols: { tickers: symbols },
      options: { lang: 'en' },
      sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
      range: [0, symbols.length],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`TradingView API error: ${response.status}`)

  const result = await response.json()

  return (result.data ?? []).map((item: { d: unknown[] }) => {
    const d = item.d
    return {
      symbol: d[0] as string,
      description: d[1] as string,
      close: d[2] as number,
      open: d[3] as number,
      high: d[4] as number,
      low: d[5] as number,
      change: d[6] as number,
      changeAbs: d[7] as number,
      volume: d[8] as number,
      classic: {
        pivot: d[9] as number,
        s1: d[10] as number,
        s2: d[11] as number,
        s3: d[12] as number,
        r1: d[13] as number,
        r2: d[14] as number,
        r3: d[15] as number,
      },
      fibonacci: { s1: d[16] as number, r1: d[17] as number },
      camarilla: { s1: d[18] as number, r1: d[19] as number },
      woodie: { s1: d[20] as number, r1: d[21] as number },
      demark: { s1: d[22] as number, r1: d[23] as number },
    }
  })
}

export const getDefaultPivots = unstable_cache(
  async () => {
    const pivots = await fetchPivotData(DEFAULT_PIVOT_SYMBOLS)
    if (pivots.length === 0) throw new Error('No pivot data')
    return pivots
  },
  ['pivots-default'],
  { revalidate: 60, tags: ['pivots'] }
)
