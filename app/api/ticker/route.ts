import { NextResponse } from 'next/server'
import { getLiveTickerSnapshot } from '@/lib/ticker'

// Shorter than the 3 s polling interval: a CDN can absorb bursts of visitors without hiding new quotes
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=1' }

export async function GET() {
  try {
    const snapshot = await getLiveTickerSnapshot()
    return NextResponse.json(
      { success: true, data: snapshot.quotes, timestamp: snapshot.updatedAt },
      { headers: CACHE_HEADERS }
    )
  } catch (error) {
    console.error('Ticker API error:', error)
    return NextResponse.json({ success: false, error: 'Cotizaciones no disponibles', data: [] }, { status: 502 })
  }
}
