import { describe, expect, it } from 'vitest'
import { calculatePivots } from './pivots'

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
    expect(woodie).toEqual({ pivot: 100, s1: 90, r1: 110 })
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
