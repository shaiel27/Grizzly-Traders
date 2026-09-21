import { NextResponse } from 'next/server'
import { RANGES, parseYahooCandles, toYahooSymbol, type Candle, type RangeKey } from '@/lib/candles'

const CACHE_TTL = 60_000
const MAX_CACHE_ENTRIES = 200
const SYMBOL_PATTERN = /^[A-Z0-9_]{1,20}:[A-Z0-9_.!-]{1,30}$/

const cache = new Map<string, { candles: Candle[]; timestamp: number }>()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase()
  const range = (searchParams.get('range') ?? '1M').toUpperCase()

  if (!SYMBOL_PATTERN.test(symbol) || !(range in RANGES)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos', data: [] }, { status: 400 })
  }

  const yahooSymbol = toYahooSymbol(symbol)
  if (!yahooSymbol) {
    return NextResponse.json({ success: false, error: 'Sin gráfico para este activo', data: [] }, { status: 404 })
  }

  const cacheKey = `${yahooSymbol}|${range}`
  const hit = cache.get(cacheKey)
  if (hit && Date.now() - hit.timestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, data: hit.candles, source: 'yahoo' })
  }

  const { interval, range: yahooRange } = RANGES[range as RangeKey]

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${yahooRange}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrizzlyTraders/1.0)' },
        signal: AbortSignal.timeout(8_000),
      }
    )
    if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`)

    const candles = parseYahooCandles(await response.json())
    if (candles.length === 0) {
      return NextResponse.json({ success: false, error: 'Sin datos para este período', data: [] }, { status: 404 })
    }

    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
    cache.set(cacheKey, { candles, timestamp: Date.now() })

    return NextResponse.json({ success: true, data: candles, source: 'yahoo' })
  } catch (error) {
    console.error('Candles API error:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cargar el gráfico', data: [] }, { status: 502 })
  }
}
