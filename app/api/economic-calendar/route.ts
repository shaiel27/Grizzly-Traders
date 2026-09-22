import { NextResponse } from 'next/server'

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? ''

interface FinnhubEvent {
  actual: number | null
  country: string
  estimate: number | null
  event: string
  impact: string
  prev: number | null
  time: string
  unit: string
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

// Finnhub: economic calendar (macro events), free tier. Only high/medium impact events are kept, the rest is noise.
export async function GET() {
  if (!FINNHUB_API_KEY) return NextResponse.json({ success: false, error: 'No configurado', data: [] }, { status: 503 })

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${isoDate(0)}&to=${isoDate(7)}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8_000) }
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const body = await response.json()
    const events = (body?.economicCalendar ?? []) as FinnhubEvent[]

    const data = events
      .filter((event) => event.impact === 'high' || event.impact === 'medium')
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 40)
      .map((event) => ({
        time: event.time,
        country: event.country,
        event: event.event,
        impact: event.impact,
        actual: typeof event.actual === 'number' ? event.actual : null,
        estimate: typeof event.estimate === 'number' ? event.estimate : null,
        previous: typeof event.prev === 'number' ? event.prev : null,
        unit: event.unit || '',
      }))

    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } })
  } catch (error) {
    console.error('Economic calendar API error:', error)
    return NextResponse.json({ success: false, error: 'Calendario no disponible', data: [] }, { status: 502 })
  }
}
