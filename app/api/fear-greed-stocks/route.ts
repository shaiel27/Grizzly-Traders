import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { parseYahooCandles } from '@/lib/candles'
import { computeStockFearGreed, type CloseSeries, type StockFearGreedInput } from '@/lib/fear-greed-stocks'

// Mismas fuente y forma de pedido que las velas (lib/candles.ts): Yahoo, cierres diarios. 2 años
// de historia sobran para la media de 125 días y dejan margen por los feriados.
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
const REQUEST_TIMEOUT_MS = 8_000

const SYMBOLS: Record<keyof StockFearGreedInput, string> = {
  spx: '^GSPC',
  vix: '^VIX',
  spy: 'SPY',
  tlt: 'TLT',
  hyg: 'HYG',
  lqd: 'LQD',
}

async function fetchCloses(symbol: string): Promise<CloseSeries> {
  const response = await fetch(`${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=2y`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Yahoo ${symbol}: HTTP ${response.status}`)
  const candles = parseYahooCandles(await response.json())
  if (candles.length === 0) throw new Error(`Yahoo ${symbol}: sin velas`)
  return candles.map(({ time, close }) => ({ time, close }))
}

// Si un cálculo falla, lanzar evita que unstable_cache guarde el fallo (misma regla que getCachedPrices)
const getCachedStockFearGreed = unstable_cache(
  async () => {
    const entries = await Promise.all(
      (Object.entries(SYMBOLS) as [keyof StockFearGreedInput, string][]).map(
        async ([key, symbol]) => [key, await fetchCloses(symbol)] as const
      )
    )
    const result = computeStockFearGreed(Object.fromEntries(entries) as unknown as StockFearGreedInput)
    if (!result) throw new Error('Historia insuficiente para el índice')
    return result
  },
  ['fear-greed-stocks'],
  { revalidate: 1800 }
)

export async function GET() {
  try {
    const result = await getCachedStockFearGreed()
    return NextResponse.json(
      { success: true, value: result.value, components: result.components, timestamp: result.timestamp },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    )
  } catch (error) {
    console.error('Stock Fear & Greed error:', error)
    return NextResponse.json({ success: false, error: 'Índice no disponible' }, { status: 502 })
  }
}
