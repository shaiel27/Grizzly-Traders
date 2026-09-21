import { NextResponse } from 'next/server'
import { DEFAULT_PIVOT_SYMBOLS, fetchPivotData, getDefaultPivots, type PivotData } from '@/lib/pivot-data'

const CACHE_TTL = 60_000
const MAX_SYMBOLS = 20
const MAX_CACHE_ENTRIES = 50
const SYMBOL_PATTERN = /^[A-Z0-9_]{1,20}:[A-Z0-9_.!-]{1,30}$/
const CACHE_CONTROL = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }

// Custom symbol sets are cached per combination so they never poison the default list
const cache = new Map<string, { data: PivotData[]; timestamp: number }>()

export async function GET(request: Request) {
  const symbolsParam = new URL(request.url).searchParams.get('symbols')
  const symbols = symbolsParam
    ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_PIVOT_SYMBOLS

  if (symbols.length === 0 || symbols.length > MAX_SYMBOLS || !symbols.every((s) => SYMBOL_PATTERN.test(s))) {
    return NextResponse.json({ success: false, error: 'Símbolos inválidos', data: [] }, { status: 400 })
  }

  try {
    if (!symbolsParam) {
      return NextResponse.json({ success: true, data: await getDefaultPivots() }, { headers: CACHE_CONTROL })
    }

    const cacheKey = symbols.join(',')
    const hit = cache.get(cacheKey)
    if (hit && Date.now() - hit.timestamp < CACHE_TTL) {
      return NextResponse.json({ success: true, data: hit.data }, { headers: CACHE_CONTROL })
    }

    const data = await fetchPivotData(symbols)
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
    cache.set(cacheKey, { data, timestamp: Date.now() })

    return NextResponse.json({ success: true, data }, { headers: CACHE_CONTROL })
  } catch (error) {
    console.error('Pivots API error:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron obtener los pivotes', data: [] }, { status: 502 })
  }
}
