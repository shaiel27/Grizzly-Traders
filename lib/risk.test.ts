import { describe, expect, it } from 'vitest'
import { calculatePosition } from './risk'

describe('calculatePosition', () => {
  it('sizes a long so the stop loses exactly the risked amount', () => {
    const result = calculatePosition({ capital: 10_000, riskPercent: 1, entry: 100, stopLoss: 95, takeProfit: 115 })
    expect(result).toMatchObject({ direction: 'long', riskAmount: 100, riskPerUnit: 5, units: 20, positionValue: 2000 })
    expect(result?.rewardAmount).toBe(300)
    expect(result?.riskReward).toBe(3)
    expect(result?.leverageNeeded).toBeCloseTo(0.2)
  })

  it('detects shorts from a stop above the entry', () => {
    const result = calculatePosition({ capital: 5_000, riskPercent: 2, entry: 50, stopLoss: 55, takeProfit: 40 })
    expect(result?.direction).toBe('short')
    expect(result?.units).toBe(20)
    expect(result?.riskReward).toBe(2)
  })

  it('works without a take profit', () => {
    const result = calculatePosition({ capital: 1_000, riskPercent: 1, entry: 10, stopLoss: 9 })
    expect(result?.rewardAmount).toBeNull()
    expect(result?.riskReward).toBeNull()
  })

  it.each([
    ['zero capital', { capital: 0, riskPercent: 1, entry: 10, stopLoss: 9 }],
    ['stop equal to entry', { capital: 100, riskPercent: 1, entry: 10, stopLoss: 10 }],
    ['risk above 100%', { capital: 100, riskPercent: 150, entry: 10, stopLoss: 9 }],
    ['NaN entry', { capital: 100, riskPercent: 1, entry: Number.NaN, stopLoss: 9 }],
    ['long with target below entry', { capital: 100, riskPercent: 1, entry: 10, stopLoss: 9, takeProfit: 8 }],
    ['short with target above entry', { capital: 100, riskPercent: 1, entry: 10, stopLoss: 11, takeProfit: 12 }],
  ])('rejects %s', (_label, input) => {
    expect(calculatePosition(input)).toBeNull()
  })
})
