import { describe, expect, it } from 'vitest'
import { ladderDomain, spreadLabels } from './pivot-layout'

describe('spreadLabels', () => {
  it('leaves well separated labels where they are', () => {
    expect(spreadLabels([20, 100, 200], 24, 0, 300)).toEqual([20, 100, 200])
  })

  it('pushes overlapping labels apart, keeping their order', () => {
    expect(spreadLabels([100, 102, 104], 24, 0, 300)).toEqual([100, 124, 148])
  })

  it('pulls a pushed block back inside the bottom edge', () => {
    const result = spreadLabels([280, 285, 290], 24, 0, 300)
    expect(result).toEqual([252, 276, 300])
    for (let i = 1; i < result.length; i++) expect(result[i] - result[i - 1]).toBeGreaterThanOrEqual(24)
  })

  it('clamps labels that start outside the box', () => {
    expect(spreadLabels([-10, 400], 24, 0, 300)).toEqual([0, 300])
  })

  it('handles an empty list', () => {
    expect(spreadLabels([], 24, 0, 300)).toEqual([])
  })
})

describe('ladderDomain', () => {
  it('pads the range of the values on both sides', () => {
    const { min, max } = ladderDomain([90, 110], 0.1)
    expect(min).toBeCloseTo(88)
    expect(max).toBeCloseTo(112)
  })

  it('never collapses when every value is equal', () => {
    const { min, max } = ladderDomain([50, 50])
    expect(max).toBeGreaterThan(min)
  })

  it('ignores non-finite values', () => {
    expect(ladderDomain([NaN, 10, 20]).min).toBeLessThan(10)
    expect(ladderDomain([])).toEqual({ min: 0, max: 1 })
  })
})
