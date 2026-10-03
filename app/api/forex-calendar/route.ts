import { NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/public'

// ForexFactory economic calendar, synced into Supabase every 30 min by the n8n automation (Apify actor scrapemint/forexfactory-economic-calendar)
export async function GET() {
  try {
    const supabase = createPublicClient()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('economic_events')
      .select(
        'id, event_date, event_time, event_timestamp, currency, impact, title, actual, actual_numeric, forecast, forecast_numeric, previous, unit, is_all_day'
      )
      .gte('event_date', since)
      .order('event_timestamp', { ascending: true, nullsFirst: false })
      .limit(200)

    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
  } catch (error) {
    console.error('Forex calendar API error:', error)
    return NextResponse.json({ success: false, error: 'Calendario no disponible', data: [] }, { status: 502 })
  }
}
