import { NextResponse } from 'next/server'
import { fetchAllPrices } from '@/lib/prices'

// Short in-memory cache (per server instance) to avoid provider rate limits
let cachedData: { prices: Awaited<ReturnType<typeof fetchAllPrices>>; timestamp: number } | null = null
const CACHE_TTL = 10_000
// Lets a CDN absorb bursts of visitors polling the same prices
const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }

export async function GET() {
  try {
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      return NextResponse.json(
        {
          success: true,
          data: cachedData.prices,
          cached: true,
          timestamp: cachedData.timestamp,
        },
        { headers: CACHE_HEADERS }
      )
    }

    const prices = await fetchAllPrices()

    if (prices.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Precios no disponibles', data: [] },
        { status: 502 }
      )
    }

    cachedData = { prices, timestamp: Date.now() }

    return NextResponse.json(
      {
        success: true,
        data: prices,
        cached: false,
        timestamp: cachedData.timestamp,
      },
      { headers: CACHE_HEADERS }
    )
  } catch (error) {
    console.error('Prices API error:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudieron obtener los precios', data: [] },
      { status: 500 }
    )
  }
}
