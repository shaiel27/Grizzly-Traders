export interface PivotResult {
  classic: { pivot: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }
  fibonacci: { pivot: number; s1: number; r1: number }
  camarilla: { s1: number; r1: number }
  woodie: { pivot: number; s1: number; r1: number }
  demark: { pivot: number; s1: number; r1: number }
}

// Inputs are the previous session's high, low and close, plus that session's open (DeMark only).
export function calculatePivots(high: number, low: number, close: number, open: number = close): PivotResult {
  const range = high - low
  const pivot = (high + low + close) / 3

  const classic = {
    pivot,
    s1: 2 * pivot - high,
    s2: pivot - range,
    s3: low - 2 * (high - pivot),
    r1: 2 * pivot - low,
    r2: pivot + range,
    r3: high + 2 * (pivot - low),
  }

  const fibonacci = {
    pivot,
    s1: pivot - range * 0.382,
    r1: pivot + range * 0.382,
  }

  const camarilla = {
    s1: close - (range * 1.1) / 12,
    r1: close + (range * 1.1) / 12,
  }

  const woodiePivot = (high + low + 2 * close) / 4
  const woodie = {
    pivot: woodiePivot,
    s1: 2 * woodiePivot - high,
    r1: 2 * woodiePivot - low,
  }

  let x: number
  if (close < open) x = high + 2 * low + close
  else if (close > open) x = 2 * high + low + close
  else x = high + low + 2 * close

  const demark = {
    pivot: x / 4,
    s1: x / 2 - high,
    r1: x / 2 - low,
  }

  return { classic, fibonacci, camarilla, woodie, demark }
}
