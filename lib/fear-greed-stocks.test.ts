import { describe, expect, it } from 'vitest'
import {
  alignByTime,
  computeStockFearGreed,
  movingAverage,
  scoreLinear,
  STOCK_FG_MIN_POINTS,
  type CloseSeries,
} from './fear-greed-stocks'

const DAY = 86_400

// Serie sintética de n cierres diarios con la forma que dicta `f(i)`
function serie(n: number, f: (i: number) => number): CloseSeries {
  return Array.from({ length: n }, (_, i) => ({ time: 1_700_000_000 + i * DAY, close: f(i) }))
}

function mercado(n: number, spx: (i: number) => number, vix: (i: number) => number) {
  return {
    spx: serie(n, spx),
    vix: serie(n, vix),
    spy: serie(n, spx),
    tlt: serie(n, () => 100),
    hyg: serie(n, () => 80),
    lqd: serie(n, () => 100),
  }
}

describe('movingAverage', () => {
  it('promedia la ventana y deja null donde no hay historia suficiente', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })
})

describe('scoreLinear', () => {
  it('mapea 0 a 50, ±rango a los extremos y recorta fuera de rango', () => {
    expect(scoreLinear(0, 0.1)).toBe(50)
    expect(scoreLinear(0.1, 0.1)).toBe(100)
    expect(scoreLinear(-0.1, 0.1)).toBe(0)
    expect(scoreLinear(0.5, 0.1)).toBe(100)
    expect(scoreLinear(-0.5, 0.1)).toBe(0)
  })
})

describe('alignByTime', () => {
  it('conserva solo los instantes presentes en todas las series', () => {
    const a = [{ time: 1, close: 10 }, { time: 2, close: 20 }, { time: 3, close: 30 }]
    const b = [{ time: 2, close: 200 }, { time: 3, close: 300 }, { time: 4, close: 400 }]
    const out = alignByTime([a, b])
    expect(out.times).toEqual([2, 3])
    expect(out.columns).toEqual([[20, 30], [200, 300]])
  })
})

describe('alineación por día', () => {
  it('alinea el VIX (07:00 UTC) con los ETF (13:30 UTC) del mismo día', () => {
    const base = 1_700_000_000 - (1_700_000_000 % DAY)
    const vix = [{ time: base + 7 * 3600, close: 15 }, { time: base + DAY + 7 * 3600, close: 16 }]
    const spy = [{ time: base + 13.5 * 3600, close: 500 }, { time: base + DAY + 13.5 * 3600, close: 501 }]
    const out = alignByTime([vix, spy], (t) => Math.floor(t / DAY))
    expect(out.columns).toEqual([[15, 16], [500, 501]])
  })
})

describe('computeStockFearGreed', () => {
  it('devuelve null si no hay historia suficiente', () => {
    expect(computeStockFearGreed(mercado(STOCK_FG_MIN_POINTS - 1, (i) => 100 + i, () => 15))).toBeNull()
  })

  it('un mercado que sube fuerte con VIX bajo da codicia (> 55)', () => {
    const out = computeStockFearGreed(mercado(400, (i) => 100 * Math.pow(1.002, i), (i) => 25 - i * 0.02))
    expect(out).not.toBeNull()
    expect(out!.value).toBeGreaterThan(55)
  })

  it('un mercado que cae fuerte con VIX alto da miedo (< 45)', () => {
    const out = computeStockFearGreed(mercado(400, (i) => 100 * Math.pow(0.998, i), (i) => 15 + i * 0.05))
    expect(out).not.toBeNull()
    expect(out!.value).toBeLessThan(45)
  })

  it('el valor está entre 0 y 100 y reporta los 4 componentes con su peso', () => {
    const out = computeStockFearGreed(mercado(400, (i) => 100 + Math.sin(i / 10) * 5, (i) => 18 + Math.cos(i / 7) * 3))!
    expect(out.value).toBeGreaterThanOrEqual(0)
    expect(out.value).toBeLessThanOrEqual(100)
    expect(out.components.map((c) => c.key).sort()).toEqual(['junkBonds', 'momentum', 'safeHaven', 'volatility'])
    for (const c of out.components) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
    }
  })

  it('el valor es el promedio de los componentes', () => {
    const out = computeStockFearGreed(mercado(400, (i) => 100 + Math.sin(i / 10) * 5, (i) => 18 + Math.cos(i / 7) * 3))!
    const media = out.components.reduce((s, c) => s + c.score, 0) / out.components.length
    expect(out.value).toBe(Math.round(media))
  })
})
