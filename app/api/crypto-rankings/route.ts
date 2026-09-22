import { NextResponse } from 'next/server'

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h&sparkline=false'

// CoinGecko: same provider already used in lib/prices.ts, just a different endpoint (market-wide ranking instead of a handful of spot prices)
export async function GET() {
  try {
    const response = await fetch(COINGECKO_URL, { next: { revalidate: 60 }, signal: AbortSignal.timeout(8_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const body = await response.json()
    if (!Array.isArray(body)) throw new Error('Unexpected payload')

    const data = body
      .map((coin) => ({
        id: String(coin.id ?? ''),
        rank: Number(coin.market_cap_rank ?? 0),
        symbol: String(coin.symbol ?? '').toUpperCase(),
        name: String(coin.name ?? ''),
        image: String(coin.image ?? ''),
        price: Number(coin.current_price ?? 0),
        change24h: Number(coin.price_change_percentage_24h ?? 0),
        marketCap: Number(coin.market_cap ?? 0),
        volume24h: Number(coin.total_volume ?? 0),
      }))
      .filter((coin) => coin.id && coin.price > 0)

    return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch (error) {
    console.error('Crypto rankings API error:', error)
    return NextResponse.json({ success: false, error: 'Ranking no disponible', data: [] }, { status: 502 })
  }
}
