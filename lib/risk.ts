export interface PositionInput {
  capital: number
  riskPercent: number
  entry: number
  stopLoss: number
  takeProfit?: number
}

export interface PositionResult {
  direction: 'long' | 'short'
  riskAmount: number
  riskPerUnit: number
  units: number
  positionValue: number
  leverageNeeded: number
  rewardAmount: number | null
  riskReward: number | null
}

// Fixed-fractional position sizing: risk a set percentage of capital between entry and stop.
export function calculatePosition(input: PositionInput): PositionResult | null {
  const { capital, riskPercent, entry, stopLoss, takeProfit } = input

  if (![capital, riskPercent, entry, stopLoss].every((value) => Number.isFinite(value) && value > 0)) return null
  if (riskPercent > 100 || entry === stopLoss) return null

  const direction = stopLoss < entry ? 'long' : 'short'
  if (takeProfit !== undefined && Number.isFinite(takeProfit) && takeProfit > 0) {
    // A target on the wrong side of the entry is invalid for this direction
    if ((direction === 'long' && takeProfit <= entry) || (direction === 'short' && takeProfit >= entry)) return null
  }

  const riskAmount = capital * (riskPercent / 100)
  const riskPerUnit = Math.abs(entry - stopLoss)
  const units = riskAmount / riskPerUnit
  const positionValue = units * entry

  const hasTarget = takeProfit !== undefined && Number.isFinite(takeProfit) && takeProfit > 0
  const rewardPerUnit = hasTarget ? Math.abs((takeProfit as number) - entry) : null

  return {
    direction,
    riskAmount,
    riskPerUnit,
    units,
    positionValue,
    leverageNeeded: positionValue / capital,
    rewardAmount: rewardPerUnit === null ? null : rewardPerUnit * units,
    riskReward: rewardPerUnit === null ? null : rewardPerUnit / riskPerUnit,
  }
}
