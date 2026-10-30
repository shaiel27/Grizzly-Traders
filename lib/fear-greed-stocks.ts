// Índice de miedo y codicia de la BOLSA, de cálculo propio (decisión del cliente, 2026-10-22:
// no usar el de CNN, cuyos términos prohíben extraerlo). Sigue la idea pública de ese índice —
// promediar indicadores de mercado puestos en una escala común de 0 (miedo extremo) a 100
// (codicia extrema) — pero con los 4 componentes que se pueden calcular con cierres diarios que ya
// tenemos (Yahoo, como en lib/candles.ts). Faltan los de amplitud y put/call del original, así que
// NO es el mismo número: la UI lo rotula como "cálculo propio".
import type { Candle } from './candles'

export type CloseSeries = Pick<Candle, 'time' | 'close'>[]

export interface StockFearGreedInput {
  spx: CloseSeries // ^GSPC
  vix: CloseSeries // ^VIX
  spy: CloseSeries // SPY (acciones, para la demanda de refugio)
  tlt: CloseSeries // TLT (bonos del Tesoro a largo plazo)
  hyg: CloseSeries // HYG (bonos de alto rendimiento)
  lqd: CloseSeries // LQD (bonos corporativos de grado de inversión)
}

export type StockFgKey = 'momentum' | 'volatility' | 'safeHaven' | 'junkBonds'

export interface StockFgComponent {
  key: StockFgKey
  score: number // 0..100
}

export interface StockFearGreed {
  value: number // 0..100, promedio redondeado de los componentes
  components: StockFgComponent[]
  timestamp: number // ms del último cierre usado
}

// Media de 125 días del momentum: hace falta al menos esa historia, más margen
export const STOCK_FG_MIN_POINTS = 130

// Rangos (en fracción) que mapean cada métrica a 0..100: el valor "normal" queda en 50 y el
// extremo observado habitualmente en cada lado, en 0 y 100. Son parámetros del indicador, no verdad
// de mercado: se ajustan aquí si el cliente pide otra sensibilidad.
const RANGO_MOMENTUM = 0.1 // S&P 500 ±10% sobre su media de 125 días
const RANGO_VOLATILIDAD = 0.4 // VIX ±40% sobre su media de 50 días (invertido)
const RANGO_REFUGIO = 0.08 // retorno de 20 días acciones − bonos, ±8 puntos
const RANGO_JUNK = 0.03 // HYG/LQD ±3% sobre su media de 50 días

export function scoreLinear(value: number, range: number): number {
  const score = 50 + (value / range) * 50
  return Math.min(100, Math.max(0, score))
}

// Media móvil simple; null donde todavía no hay `window` datos
export function movingAverage(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    out.push(i >= window - 1 ? sum / window : null)
  }
  return out
}

// Deja solo las claves presentes en TODAS las series y devuelve una columna de cierres por serie,
// alineadas. `key` agrupa los instantes (por defecto, el instante exacto): Yahoo sella la vela
// diaria del VIX a las 07:00 UTC y la de los ETF a las 13:30, así que hay que alinear por día.
export function alignByTime(
  series: CloseSeries[],
  key: (time: number) => number = (time) => time
): { times: number[]; columns: number[][] } {
  const maps = series.map((s) => new Map(s.map((p) => [key(p.time), p.close])))
  const times = Array.from(maps[0].keys())
    .filter((k) => maps.every((m) => m.has(k)))
    .sort((a, b) => a - b)
  return { times, columns: maps.map((m) => times.map((time) => m.get(time) as number)) }
}

const SEGUNDOS_DIA = 86_400
const diaUtc = (time: number) => Math.floor(time / SEGUNDOS_DIA)

function last<T>(items: T[]): T {
  return items[items.length - 1]
}

export function computeStockFearGreed(input: StockFearGreedInput): StockFearGreed | null {
  const { times, columns } = alignByTime([input.spx, input.vix, input.spy, input.tlt, input.hyg, input.lqd], diaUtc)
  if (times.length < STOCK_FG_MIN_POINTS) return null
  const [spx, vix, spy, tlt, hyg, lqd] = columns

  const maSpx = last(movingAverage(spx, 125))
  const maVix = last(movingAverage(vix, 50))
  const junk = hyg.map((close, i) => close / lqd[i])
  const maJunk = last(movingAverage(junk, 50))
  if (maSpx === null || maVix === null || maJunk === null) return null

  const n = times.length
  const retorno20 = (closes: number[]) => closes[n - 1] / closes[n - 21] - 1

  const components: StockFgComponent[] = [
    { key: 'momentum', score: scoreLinear(last(spx) / maSpx - 1, RANGO_MOMENTUM) },
    // VIX por encima de su media = miedo, así que se invierte el signo
    { key: 'volatility', score: scoreLinear(-(last(vix) / maVix - 1), RANGO_VOLATILIDAD) },
    { key: 'safeHaven', score: scoreLinear(retorno20(spy) - retorno20(tlt), RANGO_REFUGIO) },
    { key: 'junkBonds', score: scoreLinear(last(junk) / maJunk - 1, RANGO_JUNK) },
  ]
  if (components.some((c) => !Number.isFinite(c.score))) return null

  const media = components.reduce((sum, c) => sum + c.score, 0) / components.length
  return { value: Math.round(media), components, timestamp: last(times) * SEGUNDOS_DIA * 1000 }
}
