import { NextResponse } from 'next/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? ''
const SYMBOL_RE = /^[A-Z.]{1,10}$/

async function fetchJson(url: string) {
  const response = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Finnhub: company profile + fundamentals, free tier. `symbol` is the plain ticker (AAPL), not the scanner's "NASDAQ:AAPL".
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase()

  if (!FINNHUB_API_KEY) return NextResponse.json({ success: false, error: 'No configurado' }, { status: 503 })
  if (!SYMBOL_RE.test(symbol)) return NextResponse.json({ success: false, error: 'Símbolo inválido' }, { status: 400 })

  try {
    const [profile, metricBody] = await Promise.all([
      fetchJson(`${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`),
      fetchJson(`${FINNHUB_BASE}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`),
    ])

    if (!profile?.name) throw new Error('Empty profile')
    const metric = metricBody?.metric ?? {}
    const numberOrNull = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)

    return NextResponse.json(
      {
        success: true,
        data: {
          name: String(profile.name ?? ''),
          industry: String(profile.finnhubIndustry ?? ''),
          exchange: String(profile.exchange ?? ''),
          website: profile.weburl || null,
          // Finnhub reports this in millions of USD
          marketCap: numberOrNull(profile.marketCapitalization) != null ? profile.marketCapitalization * 1_000_000 : null,
          pe: numberOrNull(metric.peBasicExclExtraTTM),
          eps: numberOrNull(metric.epsBasicExclExtraTTM),
          week52High: numberOrNull(metric['52WeekHigh']),
          week52Low: numberOrNull(metric['52WeekLow']),
          dividendYield: numberOrNull(metric.dividendYieldIndicatedAnnual),
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } }
    )
  } catch (error) {
    console.error('Company profile API error:', error)
    return NextResponse.json({ success: false, error: 'Datos de la empresa no disponibles' }, { status: 502 })
  }
}
