import { NextResponse } from 'next/server'
import {
  TIMEFRAMES,
  aggregateCandles,
  isTimeframe,
  mergePartialTail,
  normalizeCandles,
  parseYahooCandles,
  toYahooSymbol,
  type Candle,
} from '@/lib/candles'

const MAX_CACHE_ENTRIES = 300
// A failing provider is covered with older candles for this long before we admit the outage
const MAX_STALE_MS = 60 * 60_000
const SYMBOL_PATTERN = /^[A-Z0-9_]{1,20}:[A-Z0-9_.!-]{1,30}$/
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

// Per server instance; shared by every visitor asking for the same symbol and timeframe
const cache = new Map<string, { candles: Candle[]; timestamp: number }>()
const inflight = new Map<string, Promise<Candle[]>>()

class NoDataError extends Error {}

// An answer, not a failure: 200 with a flag keeps the browser console free of red 404s for assets that simply have no history
// `reason` tells the chart whether another timeframe could help ('timeframe') or the asset has no history at all ('asset')
function noData(message: string, reason: 'asset' | 'timeframe') {
  return NextResponse.json({ success: false, noData: true, reason, error: message, data: [] })
}

async function fetchFromYahoo(yahooSymbol: string, interval: string, range: string): Promise<Candle[]> {
  let lastError: unknown

  // Two hosts, two attempts each: Yahoo answers 429 or 5xx in bursts and usually recovers within a moment
  for (let attempt = 0; attempt < 4; attempt++) {
    const host = YAHOO_HOSTS[attempt % YAHOO_HOSTS.length]
    try {
      const response = await fetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrizzlyTraders/1.0)' }, signal: AbortSignal.timeout(8_000) }
      )
      // A 404 is a definite answer (unknown symbol): retrying cannot fix it
      if (response.status === 404) throw new NoDataError('Yahoo has no data for this symbol')
      if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`)

      const candles = parseYahooCandles(await response.json())
      if (candles.length === 0) throw new NoDataError('Yahoo returned no candles')
      return candles
    } catch (error) {
      if (error instanceof NoDataError) throw error
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }

  throw lastError
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase()
  const timeframe = searchParams.get('tf') ?? '1d'

  if (!SYMBOL_PATTERN.test(symbol) || !isTimeframe(timeframe)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos', data: [] }, { status: 400 })
  }

  const yahooSymbol = toYahooSymbol(symbol)
  if (!yahooSymbol) {
    return noData('Este activo no tiene histórico de precios disponible', 'asset')
  }

  const spec = TIMEFRAMES[timeframe]
  const key = `${yahooSymbol}|${timeframe}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.timestamp < spec.ttlMs) {
    return NextResponse.json({ success: true, data: hit.candles, timeframe }, { headers: { 'Cache-Control': 'public, s-maxage=10' } })
  }

  let pending = inflight.get(key)
  if (!pending) {
    pending = fetchFromYahoo(yahooSymbol, spec.interval, spec.range)
      .then(normalizeCandles)
      .then((candles) => ('minGapSeconds' in spec ? mergePartialTail(candles, spec.minGapSeconds) : candles))
      .then((candles) => ('aggregateSeconds' in spec ? aggregateCandles(candles, spec.aggregateSeconds) : candles))
      .then((candles) => {
        if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
        cache.set(key, { candles, timestamp: Date.now() })
        return candles
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }

  try {
    const candles = await pending
    return NextResponse.json({ success: true, data: candles, timeframe }, { headers: { 'Cache-Control': 'public, s-maxage=10' } })
  } catch (error) {
    if (error instanceof NoDataError) {
      return noData('No hay datos para este activo en esta temporalidad', 'timeframe')
    }

    console.error('Candles API error:', error)
    if (hit && Date.now() - hit.timestamp < MAX_STALE_MS) {
      return NextResponse.json({ success: true, data: hit.candles, timeframe, stale: true })
    }
    return NextResponse.json({ success: false, error: 'No se pudo cargar el gráfico', data: [] }, { status: 502 })
  }
}
