import { NextResponse } from 'next/server'
import { getPivotQuotes, isPivotTimeframe } from '@/lib/pivot-data'

const CACHE_CONTROL = { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' }

export async function GET(request: Request) {
  const timeframe = (new URL(request.url).searchParams.get('tf') ?? 'D').toUpperCase()

  if (!isPivotTimeframe(timeframe)) {
    return NextResponse.json({ success: false, error: 'Período inválido', data: [] }, { status: 400 })
  }

  try {
    return NextResponse.json({ success: true, timeframe, data: await getPivotQuotes(timeframe) }, { headers: CACHE_CONTROL })
  } catch (error) {
    console.error('Pivots API error:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron obtener los pivotes', data: [] }, { status: 502 })
  }
}
