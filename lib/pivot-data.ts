import { unstable_cache } from 'next/cache'
import { scanTradingView, type ScannerRow } from './markets'
import { mergePartialTail, normalizeCandles, parseYahooCandles, toYahooSymbol } from './candles'
import { PIVOT_ASSETS, PIVOT_ASSET_BY_TV } from './pivot-assets'
import type { PivotQuote, PivotTimeframe } from './pivot-types'

export { PIVOT_TIMEFRAMES, isPivotTimeframe } from './pivot-types'
export type { PivotQuote, PivotTimeframe } from './pivot-types'


// The scanner's own Pivot.M.* columns are MONTHLY pivots whatever the timeframe, so levels are computed
// here from the previous period's OHLC instead ([1] is one bar back, |1W and |1M pick the bar size).
const TIMEFRAME_SUFFIX: Record<PivotTimeframe, string> = { D: '', W: '|1W', M: '|1M' }

type Previous = PivotQuote['previous']

// Los contratos continuos de futuros (`1!`) devuelven null en `|1W` y `|1M` (verificado en vivo el 2026-10-22 con
// ES, NQ, FDAX, GC...; el diario `[1]` si funciona). Lo unico mensual que si calcula el scanner para ellos son los
// pivotes clasicos del mes anterior, de los que se recupera el HLC; la semana sale de las velas de Yahoo cuando el
// contrato las tiene (`=F`). Sin ninguna de las dos fuentes (FDAX, FESX... en semanal) la fila se descarta.
const CLASSIC_FALLBACK_COLUMNS = ['Pivot.M.Classic.Middle', 'Pivot.M.Classic.R1', 'Pivot.M.Classic.S1']

export function pivotColumns(timeframe: PivotTimeframe): string[] {
  const suffix = TIMEFRAME_SUFFIX[timeframe]
  return [
    'name',
    'description',
    'close',
    'change',
    'change_abs',
    `open[1]${suffix}`,
    `high[1]${suffix}`,
    `low[1]${suffix}`,
    `close[1]${suffix}`,
    ...(timeframe === 'M' ? CLASSIC_FALLBACK_COLUMNS : []),
  ]
}

const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

// Pivote clasico: P = (H+L+C)/3, R1 = 2P-L, S1 = 2P-H  =>  H = 2P-S1, L = 2P-R1, C = 3P-H-L. No trae la apertura.
export function previousFromClassicPivots(middle: unknown, r1: unknown, s1: unknown): Previous | null {
  if (!isPositive(middle) || !isPositive(r1) || !isPositive(s1)) return null
  const high = 2 * middle - s1
  const low = 2 * middle - r1
  const close = 3 * middle - high - low
  if (!isPositive(high) || !isPositive(low) || !isPositive(close) || high < low) return null
  return { open: close, high, low, close }
}

// HLC del periodo anterior tal como lo devuelve el scanner (columnas 5-8), o null si viene incompleto
function previousFromScanner(d: ScannerRow['d']): Previous | null {
  const [open, high, low, close] = d.slice(5, 9)
  return isPositive(high) && isPositive(low) && isPositive(close) && high >= low
    ? // DeMark needs the open; falling back to the close makes it behave like a flat session
      { open: isPositive(open) ? open : close, high, low, close }
    : null
}

// Rows come back in the scanner's order; results follow the catalog order. Rows with unusable data are dropped,
// unless `fallback` (keyed by TradingView ticker) has the previous bar from another source.
export function mapPivotRows(rows: ScannerRow[], fallback: ReadonlyMap<string, Previous> = new Map()): PivotQuote[] {
  const byTicker = new Map(rows.map((row) => [row.s, row.d]))

  return PIVOT_ASSETS.flatMap((asset): PivotQuote[] => {
    const d = byTicker.get(asset.tv)
    if (!d) return []

    const [ticker, description, price, change, changeAbs, , , , , pMiddle, pR1, pS1] = d
    if (!isPositive(price)) return []

    // Orden: HLC del scanner > barra real de Yahoo (trae la apertura) > pivotes clasicos (no la traen)
    const previous = previousFromScanner(d) ?? fallback.get(asset.tv) ?? previousFromClassicPivots(pMiddle, pR1, pS1)
    if (!previous) return []

    return [
      {
        symbol: asset.tv,
        ticker: typeof ticker === 'string' ? ticker : asset.tv,
        description: typeof description === 'string' ? description : asset.name,
        price,
        change: typeof change === 'number' ? change : 0,
        changeAbs: typeof changeAbs === 'number' ? changeAbs : 0,
        previous,
      },
    ]
  })
}

// Barra anterior (cerrada) de una serie semanal/mensual de Yahoo. La ultima barra es la del periodo en curso y Yahoo
// agrega ademas una estampada "ahora" que repite el dia: mergePartialTail la funde antes de contar.
export function previousBarFromCandles(candles: ReturnType<typeof parseYahooCandles>, timeframe: 'W' | 'M'): Previous | null {
  const sorted = normalizeCandles(candles)
  const merged = timeframe === 'W' ? mergePartialTail(sorted, 6 * 86_400, 'week') : mergePartialTail(sorted, 27 * 86_400, 'month')
  const bar = merged.length >= 2 ? merged[merged.length - 2] : null
  return bar && bar.high >= bar.low ? { open: bar.open, high: bar.high, low: bar.low, close: bar.close } : null
}

const YAHOO_TIMEOUT_MS = 8_000
// El periodo anterior no cambia hasta el cierre del actual: 10 min alcanzan y evitan pegarle a Yahoo cada 15 s
const YAHOO_TTL_MS = 10 * 60_000
const yahooPrevious = new Map<string, { previous: Previous; at: number }>()

async function fetchYahooPrevious(yahooSymbol: string, timeframe: 'W' | 'M'): Promise<Previous | null> {
  const key = `${yahooSymbol}|${timeframe}`
  const hit = yahooPrevious.get(key)
  if (hit && Date.now() - hit.at < YAHOO_TTL_MS) return hit.previous

  try {
    const [interval, range] = timeframe === 'W' ? ['1wk', '3mo'] : ['1mo', '1y']
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrizzlyTraders/1.0)' }, signal: AbortSignal.timeout(YAHOO_TIMEOUT_MS) }
    )
    if (!response.ok) return null
    const payload = await response.json()
    if (payload?.chart?.error) return null
    const previous = previousBarFromCandles(parseYahooCandles(payload), timeframe)
    // Solo se guarda lo que salio bien: un fallo nunca queda cacheado
    if (previous) yahooPrevious.set(key, { previous, at: Date.now() })
    return previous
  } catch {
    return null
  }
}

// Pedidos a Yahoo en paralelo como maximo: ~20 futuros a la vez saturan el origen
const YAHOO_CONCURRENCY = 6

// Ejecuta `task` sobre `items` con a lo sumo `limit` en vuelo; conserva el orden del resultado
export async function mapWithLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Filas con precio pero sin HLC del scanner (futuros continuos en semanal/mensual) que tengan velas en Yahoo.
// En el marco mensual se consulta Yahoo ANTES que los pivotes clasicos: su barra trae la apertura real, y los
// clasicos solo se usan si Yahoo no responde (mapPivotRows los aplica en ese orden).
export function rowsNeedingYahoo(rows: ScannerRow[]): ScannerRow[] {
  return rows.filter((row) => PIVOT_ASSET_BY_TV.has(row.s) && isPositive(row.d[2]) && previousFromScanner(row.d) === null)
}

async function yahooFallbackFor(rows: ScannerRow[], timeframe: 'W' | 'M'): Promise<Map<string, Previous>> {
  const found = await mapWithLimit(rowsNeedingYahoo(rows), YAHOO_CONCURRENCY, async (row) => {
    const yahoo = toYahooSymbol(row.s)
    return [row.s, yahoo ? await fetchYahooPrevious(yahoo, timeframe) : null] as const
  })
  return new Map(found.filter((entry): entry is readonly [string, Previous] => entry[1] !== null))
}

export async function fetchPivotQuotes(timeframe: PivotTimeframe): Promise<PivotQuote[]> {
  const rows = await scanTradingView(
    PIVOT_ASSETS.map((asset) => asset.tv),
    pivotColumns(timeframe)
  )
  if (timeframe === 'D') return mapPivotRows(rows)
  return mapPivotRows(rows, await yahooFallbackFor(rows, timeframe))
}

function cachedQuotes(timeframe: PivotTimeframe) {
  return unstable_cache(
    async () => {
      const quotes = await fetchPivotQuotes(timeframe)
      // An empty result must not be cached, otherwise one bad moment sticks around
      if (quotes.length === 0) throw new Error('No pivot data')
      return quotes
    },
    ['pivot-quotes', timeframe],
    { revalidate: 15, tags: ['pivots'] }
  )
}

const cachedByTimeframe = { D: cachedQuotes('D'), W: cachedQuotes('W'), M: cachedQuotes('M') }

export function getPivotQuotes(timeframe: PivotTimeframe): Promise<PivotQuote[]> {
  return cachedByTimeframe[timeframe]()
}
