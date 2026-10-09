export const PIVOT_METHODS = ['classic', 'fibonacci', 'camarilla', 'woodie', 'demark'] as const
export type PivotMethod = (typeof PIVOT_METHODS)[number]

export interface PivotResult {
  classic: { pivot: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }
  fibonacci: { pivot: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }
  camarilla: { pivot: number; s1: number; s2: number; s3: number; s4: number; r1: number; r2: number; r3: number; r4: number }
  woodie: { pivot: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }
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
    s2: pivot - range * 0.618,
    s3: pivot - range,
    r1: pivot + range * 0.382,
    r2: pivot + range * 0.618,
    r3: pivot + range,
  }

  // Camarilla levels hang off the close: 1.1 x range split by 12, 6, 4 and 2
  const camarilla = {
    pivot,
    s1: close - (range * 1.1) / 12,
    s2: close - (range * 1.1) / 6,
    s3: close - (range * 1.1) / 4,
    s4: close - (range * 1.1) / 2,
    r1: close + (range * 1.1) / 12,
    r2: close + (range * 1.1) / 6,
    r3: close + (range * 1.1) / 4,
    r4: close + (range * 1.1) / 2,
  }

  const woodiePivot = (high + low + 2 * close) / 4
  const woodie = {
    pivot: woodiePivot,
    s1: 2 * woodiePivot - high,
    s2: woodiePivot - range,
    s3: low - 2 * (high - woodiePivot),
    r1: 2 * woodiePivot - low,
    r2: woodiePivot + range,
    r3: high + 2 * (woodiePivot - low),
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

export type PivotLevelKind = 'resistance' | 'pivot' | 'support'

export interface PivotLevel {
  key: string
  label: string
  value: number
  kind: PivotLevelKind
}

function levelKind(key: string): PivotLevelKind {
  if (key.startsWith('r')) return 'resistance'
  if (key.startsWith('s')) return 'support'
  return 'pivot'
}

// Every level of one method, highest price first (R4 ... PP ... S4)
export function levelsFor(result: PivotResult, method: PivotMethod): PivotLevel[] {
  return Object.entries(result[method])
    .map(([key, value]) => ({
      key,
      label: key === 'pivot' ? 'PP' : key.toUpperCase(),
      value: value as number,
      kind: levelKind(key),
    }))
    .sort((a, b) => b.value - a.value)
}

export type PivotBias = 'bullish' | 'bearish' | 'neutral'

export type PivotZoneKind = 'none' | 'between' | 'below' | 'above'

export interface PricePosition {
  bias: PivotBias
  resistance: PivotLevel | null
  support: PivotLevel | null
  // The sentence itself is locale-dependent, so this only reports which shape it has — the
  // caller builds the actual text (dict.pivotZone.*) from this plus support/resistance.label.
  zoneKind: PivotZoneKind
}

// Where the price sits relative to the ladder: bias from the pivot, and the levels that box it in
export function analyzePosition(levels: PivotLevel[], price: number): PricePosition {
  const pivot = levels.find((level) => level.kind === 'pivot')
  let bias: PivotBias = 'neutral'
  if (pivot) bias = price > pivot.value ? 'bullish' : price < pivot.value ? 'bearish' : 'neutral'

  let resistance: PivotLevel | null = null
  let support: PivotLevel | null = null
  for (const level of levels) {
    if (level.value > price && (!resistance || level.value < resistance.value)) resistance = level
    if (level.value < price && (!support || level.value > support.value)) support = level
  }

  let zoneKind: PivotZoneKind = 'none'
  if (resistance && support) zoneKind = 'between'
  else if (resistance) zoneKind = 'below'
  else if (support) zoneKind = 'above'

  return { bias, resistance, support, zoneKind }
}

export function distancePct(value: number, price: number): number {
  return ((value - price) / price) * 100
}

export interface Confluence {
  value: number
  levels: { method: PivotMethod; label: string; value: number }[]
}

// Levels from different methods that land within `tolerancePct` of each other tend to act as stronger zones.
// Fibonacci and Camarilla reuse the classic pivot, so their PP would be a trivial "confluence" and is skipped.
export function findConfluences(result: PivotResult, tolerancePct = 0.1): Confluence[] {
  const all = PIVOT_METHODS.flatMap((method) =>
    levelsFor(result, method)
      .filter((level) => !(level.kind === 'pivot' && (method === 'fibonacci' || method === 'camarilla')))
      .map((level) => ({ method, label: level.label, value: level.value }))
  ).sort((a, b) => a.value - b.value)

  const clusters: Confluence['levels'][] = []
  let current: Confluence['levels'] = []
  for (const level of all) {
    const previous = current[current.length - 1]
    if (previous && level.value !== 0 && Math.abs(level.value - previous.value) / Math.abs(level.value) <= tolerancePct / 100) {
      current.push(level)
    } else {
      if (current.length) clusters.push(current)
      current = [level]
    }
  }
  if (current.length) clusters.push(current)

  return clusters
    .filter((levels) => new Set(levels.map((level) => level.method)).size >= 2)
    .map((levels) => ({ value: levels.reduce((sum, level) => sum + level.value, 0) / levels.length, levels }))
    .sort((a, b) => b.value - a.value)
}

// Accepts both "1234.56" and "1.234,56"; the last separator is taken as the decimal one
export function parseDecimal(text: string): number {
  const cleaned = text.trim().replace(/\s/g, '')
  if (!cleaned) return NaN

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  let normalized = cleaned
  if (lastComma > -1 && lastDot > -1) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const group = decimal === ',' ? '.' : ','
    normalized = cleaned.split(group).join('').replace(decimal, '.')
  } else if (lastComma > -1) {
    normalized = cleaned.replace(',', '.')
  }

  return /^-?(\d+\.?\d*|\.\d+)$/.test(normalized) ? Number(normalized) : NaN
}

export interface OhlcInput {
  high: number
  low: number
  close: number
  open?: number
}

// Keys only — the message itself is locale-dependent (dict.pivotCalculator.error*), resolved by the caller
export type OhlcErrorKey = 'required' | 'mustBePositive' | 'highBelowLow' | 'closeOutOfRange' | 'openOutOfRange'
export type OhlcErrors = Partial<Record<'high' | 'low' | 'close' | 'open', OhlcErrorKey>>

const isPrice = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

// `open` is optional (only DeMark uses it), so an empty (NaN) open is not an error
export function validateOhlc({ high, low, close, open }: OhlcInput): OhlcErrors {
  const errors: OhlcErrors = {}

  if (Number.isNaN(high)) errors.high = 'required'
  else if (!isPrice(high)) errors.high = 'mustBePositive'
  if (Number.isNaN(low)) errors.low = 'required'
  else if (!isPrice(low)) errors.low = 'mustBePositive'
  if (Number.isNaN(close)) errors.close = 'required'
  else if (!isPrice(close)) errors.close = 'mustBePositive'
  if (open !== undefined && !Number.isNaN(open) && !isPrice(open)) errors.open = 'mustBePositive'

  if (isPrice(high) && isPrice(low) && high < low) errors.high = 'highBelowLow'

  if (isPrice(high) && isPrice(low) && high >= low) {
    if (isPrice(close) && (close > high || close < low)) errors.close = 'closeOutOfRange'
    if (isPrice(open) && (open > high || open < low)) errors.open = 'openOutOfRange'
  }

  return errors
}
