import { NextResponse } from 'next/server'
import { scanTradingView } from '@/lib/markets'
import { createLruCache } from '@/lib/lru'

const MAX_CACHE_ENTRIES = 300
const SYMBOL_PATTERN = /^[A-Z0-9_]{1,20}:[A-Z0-9_.!-]{1,30}$/
const QUOTE_TTL_MS = 5_000
// Un símbolo que el scanner no conoce no empieza a existir en segundos: sin caché negativa cada
// sondeo de 7 s de cada visitante vuelve a pegarle al scanner con el mismo 404
const NOT_FOUND_TTL_MS = 45_000

interface QuotePayload {
  symbol: string
  close: number
  change: number
  changeAbs: number
}

// Por instancia del servidor; compartida por cada visitante que pide el mismo símbolo.
// LRU (recency on get) en vez de FIFO: los símbolos en vigilancia conservan su hueco.
const cache = createLruCache<string, { data: QuotePayload; timestamp: number }>(MAX_CACHE_ENTRIES)
const notFound = createLruCache<string, number>(MAX_CACHE_ENTRIES)
const inflight = new Map<string, Promise<QuotePayload>>()

// Sin precio es una respuesta, no un fallo: el scanner omite los símbolos que no conoce
class NoPriceError extends Error {}

async function fetchQuote(symbol: string): Promise<QuotePayload> {
  const rows = await scanTradingView([symbol], ['close', 'change', 'change_abs'])
  const row = rows.find((r) => r.s === symbol)
  if (!row) throw new NoPriceError('Activo sin precio')

  const close = row.d[0] as number
  if (!Number.isFinite(close)) throw new NoPriceError('Activo sin precio')

  // change/change_abs pueden venir vacíos del scanner: el contrato exige números, y los
  // llamadores ya interpretan 0 como "sin variación conocida"
  const change = row.d[1] as number
  const changeAbs = row.d[2] as number
  return {
    symbol,
    close,
    change: Number.isFinite(change) ? change : 0,
    changeAbs: Number.isFinite(changeAbs) ? changeAbs : 0,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase()

  if (!SYMBOL_PATTERN.test(symbol)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.timestamp < QUOTE_TTL_MS) {
    return NextResponse.json(
      { success: true, data: hit.data, ts: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=5' } }
    )
  }

  const missingSince = notFound.get(symbol)
  if (missingSince !== undefined && Date.now() - missingSince < NOT_FOUND_TTL_MS) {
    return NextResponse.json({ success: false, error: 'Activo sin precio' }, { status: 404 })
  }

  let pending = inflight.get(symbol)
  if (!pending) {
    pending = fetchQuote(symbol)
      .then((data) => {
        cache.set(symbol, { data, timestamp: Date.now() })
        notFound.delete(symbol)
        return data
      })
      .catch((error) => {
        if (error instanceof NoPriceError) {
          notFound.set(symbol, Date.now())
        }
        throw error
      })
      .finally(() => inflight.delete(symbol))
    inflight.set(symbol, pending)
  }

  try {
    const quote = await pending
    return NextResponse.json(
      { success: true, data: { symbol: quote.symbol, close: quote.close, change: quote.change, changeAbs: quote.changeAbs }, ts: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=3, stale-while-revalidate=5' } }
    )
  } catch (error) {
    if (error instanceof NoPriceError) {
      return NextResponse.json({ success: false, error: 'Activo sin precio' }, { status: 404 })
    }

    console.error('Quote API error:', error)
    return NextResponse.json({ success: false, error: 'Precio no disponible' }, { status: 502 })
  }
}
