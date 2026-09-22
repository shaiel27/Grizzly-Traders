import { describe, expect, it } from 'vitest'
import {
  analyzePosition,
  calculatePivots,
  distancePct,
  findConfluences,
  levelsFor,
  parseDecimal,
  validateOhlc,
} from './pivots'

// H=110, L=90, C=100 -> pivot 100, range 20
const H = 110
const L = 90
const C = 100

describe('calculatePivots', () => {
  it('computes classic levels', () => {
    const { classic } = calculatePivots(H, L, C)
    expect(classic).toEqual({ pivot: 100, s1: 90, s2: 80, s3: 70, r1: 110, r2: 120, r3: 130 })
  })

  it('anchors fibonacci levels on the pivot, not the close', () => {
    const { fibonacci } = calculatePivots(H, L, 103)
    const pivot = (H + L + 103) / 3
    expect(fibonacci.pivot).toBeCloseTo(pivot)
    expect(fibonacci.s1).toBeCloseTo(pivot - 20 * 0.382)
    expect(fibonacci.r1).toBeCloseTo(pivot + 20 * 0.382)
  })

  it('uses the /12 factor for camarilla S1/R1', () => {
    const { camarilla } = calculatePivots(H, L, C)
    expect(camarilla.s1).toBeCloseTo(100 - (20 * 1.1) / 12)
    expect(camarilla.r1).toBeCloseTo(100 + (20 * 1.1) / 12)
  })

  it('computes woodie levels', () => {
    const { woodie } = calculatePivots(H, L, C)
    expect(woodie).toMatchObject({ pivot: 100, s1: 90, r1: 110 })
  })

  it.each([
    { open: 95, x: 410 },
    { open: 105, x: 390 },
    { open: 100, x: 400 },
  ])('computes demark levels when open is $open', ({ open, x }) => {
    const { demark } = calculatePivots(H, L, C, open)
    expect(demark.pivot).toBe(x / 4)
    expect(demark.s1).toBe(x / 2 - H)
    expect(demark.r1).toBe(x / 2 - L)
  })

  it('treats a missing open as equal to the close', () => {
    expect(calculatePivots(H, L, C).demark).toEqual(calculatePivots(H, L, C, C).demark)
  })
})

describe('full ladders', () => {
  it('extends fibonacci to three levels on each side', () => {
    const { fibonacci } = calculatePivots(H, L, C)
    expect(fibonacci.s2).toBeCloseTo(100 - 20 * 0.618)
    expect(fibonacci.s3).toBeCloseTo(80)
    expect(fibonacci.r2).toBeCloseTo(100 + 20 * 0.618)
    expect(fibonacci.r3).toBeCloseTo(120)
  })

  it('extends camarilla to four levels with the /12, /6, /4 and /2 factors', () => {
    const { camarilla } = calculatePivots(H, L, C)
    expect(camarilla.r2).toBeCloseTo(100 + (20 * 1.1) / 6)
    expect(camarilla.r3).toBeCloseTo(100 + (20 * 1.1) / 4)
    expect(camarilla.r4).toBeCloseTo(100 + (20 * 1.1) / 2)
    expect(camarilla.s4).toBeCloseTo(100 - (20 * 1.1) / 2)
  })

  it('extends woodie with second and third levels', () => {
    const { woodie } = calculatePivots(H, L, C)
    expect(woodie.r2).toBe(120)
    expect(woodie.s2).toBe(80)
    expect(woodie.r3).toBe(H + 2 * (100 - L))
    expect(woodie.s3).toBe(L - 2 * (H - 100))
  })
})

describe('levelsFor', () => {
  it('lists every level of a method from highest to lowest', () => {
    const levels = levelsFor(calculatePivots(H, L, C), 'classic')
    expect(levels.map((level) => level.label)).toEqual(['R3', 'R2', 'R1', 'PP', 'S1', 'S2', 'S3'])
    expect(levels.map((level) => level.value)).toEqual([130, 120, 110, 100, 90, 80, 70])
  })

  it('tags each level as resistance, pivot or support', () => {
    const levels = levelsFor(calculatePivots(H, L, C), 'demark')
    expect(levels.map((level) => level.kind).sort()).toEqual(['pivot', 'resistance', 'support'])
  })

  it('exposes the four camarilla levels per side', () => {
    expect(levelsFor(calculatePivots(H, L, C), 'camarilla')).toHaveLength(9)
  })
})

describe('analyzePosition', () => {
  const levels = levelsFor(calculatePivots(H, L, C), 'classic')

  it('finds the levels that box the price in', () => {
    const position = analyzePosition(levels, 95)
    expect(position.support?.label).toBe('S1')
    expect(position.resistance?.label).toBe('PP')
    expect(position.zone).toBe('Entre S1 y PP')
    expect(position.bias).toBe('bearish')
  })

  it('reads a price above the pivot as bullish', () => {
    expect(analyzePosition(levels, 105).bias).toBe('bullish')
  })

  it('reports prices beyond the outer levels', () => {
    expect(analyzePosition(levels, 140)).toMatchObject({ resistance: null, zone: 'Sobre R3' })
    expect(analyzePosition(levels, 60)).toMatchObject({ support: null, zone: 'Bajo S3' })
  })

  it('does not treat a level equal to the price as either side', () => {
    const position = analyzePosition(levels, 100)
    expect(position.bias).toBe('neutral')
    expect(position.support?.label).toBe('S1')
    expect(position.resistance?.label).toBe('R1')
  })
})

describe('distancePct', () => {
  it('is signed relative to the price', () => {
    expect(distancePct(110, 100)).toBeCloseTo(10)
    expect(distancePct(90, 100)).toBeCloseTo(-10)
  })
})

describe('findConfluences', () => {
  it('groups levels of different methods that almost coincide', () => {
    // Classic R2 and Woodie R2 are both 120 here
    const r2 = findConfluences(calculatePivots(H, L, C)).find((confluence) => Math.abs(confluence.value - 120) < 0.5)
    expect(r2).toBeDefined()
    expect(new Set(r2!.levels.map((level) => level.method)).size).toBeGreaterThanOrEqual(2)
  })

  it('never reports a single method as a confluence', () => {
    for (const confluence of findConfluences(calculatePivots(H, L, C))) {
      expect(new Set(confluence.levels.map((level) => level.method)).size).toBeGreaterThanOrEqual(2)
    }
  })

  it('ignores the pivot that fibonacci and camarilla copy from classic', () => {
    const levels = findConfluences(calculatePivots(H, L, C)).flatMap((confluence) => confluence.levels)
    expect(levels.some((level) => level.label === 'PP' && (level.method === 'fibonacci' || level.method === 'camarilla'))).toBe(false)
  })

  it('narrows down with a tighter tolerance', () => {
    const result = calculatePivots(H, L, C)
    expect(findConfluences(result, 0.0001).length).toBeLessThanOrEqual(findConfluences(result, 1).length)
  })

  it('returns the highest zone first', () => {
    const values = findConfluences(calculatePivots(H, L, C), 0.5).map((confluence) => confluence.value)
    expect(values).toEqual([...values].sort((a, b) => b - a))
  })
})

describe('parseDecimal', () => {
  it.each([
    ['1234.56', 1234.56],
    ['1234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['  0.5 ', 0.5],
    ['.5', 0.5],
    ['5.', 5],
  ])('reads %s as %d', (text, expected) => {
    expect(parseDecimal(text)).toBe(expected)
  })

  it.each(['', '  ', 'abc', '1.2.3', '12a', '--1'])('rejects %j', (text) => {
    expect(parseDecimal(text)).toBeNaN()
  })
})

describe('validateOhlc', () => {
  it('accepts a coherent session', () => {
    expect(validateOhlc({ high: 110, low: 90, close: 100, open: 95 })).toEqual({})
  })

  it('treats the open as optional', () => {
    expect(validateOhlc({ high: 110, low: 90, close: 100, open: NaN })).toEqual({})
    expect(validateOhlc({ high: 110, low: 90, close: 100 })).toEqual({})
  })

  it('asks for the required fields', () => {
    expect(validateOhlc({ high: NaN, low: NaN, close: NaN })).toEqual({ high: 'Requerido', low: 'Requerido', close: 'Requerido' })
  })

  it('rejects zero and negative prices', () => {
    expect(validateOhlc({ high: 0, low: -1, close: 5 })).toMatchObject({ high: expect.any(String), low: expect.any(String) })
  })

  it('rejects a high below the low', () => {
    expect(validateOhlc({ high: 90, low: 110, close: 100 }).high).toMatch(/máximo/)
  })

  it('keeps the close and the open inside the range', () => {
    const errors = validateOhlc({ high: 110, low: 90, close: 120, open: 80 })
    expect(errors.close).toMatch(/cierre/)
    expect(errors.open).toMatch(/apertura/)
  })

  it('does not pile range errors onto an inverted range', () => {
    expect(validateOhlc({ high: 90, low: 110, close: 100 }).close).toBeUndefined()
  })
})
