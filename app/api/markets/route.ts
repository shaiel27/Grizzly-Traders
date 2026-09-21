import { NextResponse } from 'next/server'
import { getMarkets } from '@/lib/markets'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'all'
  const search = searchParams.get('search')?.toLowerCase() || ''

  try {
    let markets = await getMarkets()

    if (category !== 'all') markets = markets.filter((a) => a.category === category)
    if (search) {
      markets = markets.filter((a) => a.name.toLowerCase().includes(search) || a.description.toLowerCase().includes(search))
    }

    return NextResponse.json(
      { success: true, data: markets },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    )
  } catch (error) {
    console.error('Markets API error:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron obtener los mercados', data: [] }, { status: 502 })
  }
}
