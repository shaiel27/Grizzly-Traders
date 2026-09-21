import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1', {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const body = await response.json()
    const entry = body?.data?.[0]
    const value = Number(entry?.value)
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Invalid payload')

    return NextResponse.json(
      { success: true, value, classification: String(entry.value_classification ?? ''), timestamp: Number(entry.timestamp) * 1000 },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } }
    )
  } catch (error) {
    console.error('Fear & Greed API error:', error)
    return NextResponse.json({ success: false, error: 'Índice no disponible' }, { status: 502 })
  }
}
