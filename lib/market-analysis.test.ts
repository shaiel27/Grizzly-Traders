import { describe, expect, it } from 'vitest'
import { adxReading, compareWithAverages, macdReading, rangePosition, rsiReading, signalFor, type ReadingKey } from './market-analysis'
import en from './i18n/dictionaries/en.json'
import es from './i18n/dictionaries/es.json'

describe('signalFor', () => {
  it.each([
    [0.8, 'strongBuy', 'positive'],
    [0.5, 'strongBuy', 'positive'],
    [0.2, 'buy', 'positive'],
    [0.1, 'buy', 'positive'],
    [0.05, 'neutral', 'neutral'],
    [-0.05, 'neutral', 'neutral'],
    [-0.1, 'sell', 'negative'],
    [-0.5, 'strongSell', 'negative'],
  ])('reads %d as %s', (value, key, tone) => {
    expect(signalFor(value)).toEqual({ key, tone })
  })

  it('handles missing values', () => {
    expect(signalFor(null).key).toBe('noData')
    expect(signalFor(NaN).key).toBe('noData')
  })
})

describe('rsiReading', () => {
  it('flags overbought and oversold levels', () => {
    expect(rsiReading(72)).toEqual({ key: 'overbought', tone: 'negative' })
    expect(rsiReading(28)).toEqual({ key: 'oversold', tone: 'positive' })
    expect(rsiReading(50).tone).toBe('neutral')
  })

  it('treats a missing or zero RSI as no data', () => {
    expect(rsiReading(0).key).toBe('noData')
    expect(rsiReading(undefined).key).toBe('noData')
  })
})

describe('macdReading', () => {
  it('compares the MACD line with its signal', () => {
    expect(macdReading(2, 1).tone).toBe('positive')
    expect(macdReading(1, 2).tone).toBe('negative')
    expect(macdReading(1, 1).tone).toBe('neutral')
    expect(macdReading(null, 1).key).toBe('noData')
  })
})

describe('adxReading', () => {
  it('describes trend strength without taking a side', () => {
    expect(adxReading(30).key).toBe('strongTrend')
    expect(adxReading(22).key).toBe('moderateTrend')
    expect(adxReading(15).key).toBe('noDefinedTrend')
    expect(adxReading(30).tone).toBe('neutral')
  })
})

describe('rangePosition', () => {
  it('places the value between the low and the high', () => {
    expect(rangePosition(75, 50, 100)).toBe(50)
    expect(rangePosition(50, 50, 100)).toBe(0)
  })

  it('clamps values outside the range and rejects degenerate ranges', () => {
    expect(rangePosition(120, 50, 100)).toBe(100)
    expect(rangePosition(10, 50, 100)).toBe(0)
    expect(rangePosition(5, 10, 10)).toBeNull()
    expect(rangePosition(5, null, 10)).toBeNull()
  })
})

describe('compareWithAverages', () => {
  it('reports the distance of the price from each average', () => {
    const result = compareWithAverages(110, [
      { label: 'EMA 10', value: 100 },
      { label: 'SMA 200', value: 200 },
    ])
    expect(result[0]).toEqual({ label: 'EMA 10', value: 100, distancePct: 10 })
    expect(result[1].distancePct).toBeCloseTo(-45)
  })

  it('drops averages without a usable value', () => {
    expect(compareWithAverages(100, [{ label: 'VWAP', value: null }, { label: 'EMA', value: 0 }, { label: 'SMA', value: 95 }])).toHaveLength(1)
  })
})

describe('ReadingKey dictionary coverage', () => {
  // Every key the union can produce must resolve to a translated string in both locales — this is
  // what keeps lib/market-analysis.ts locale-agnostic (it only ever emits these keys) honest against
  // lib/i18n/dictionaries/*.json (findMissingKeys can't catch this: the keys live in a TS union, not JSON).
  const allKeys: ReadingKey[] = [
    'noData',
    'strongBuy',
    'buy',
    'sell',
    'strongSell',
    'neutral',
    'overbought',
    'oversold',
    'bullishAboveSignal',
    'bearishBelowSignal',
    'strongTrend',
    'noDefinedTrend',
    'moderateTrend',
  ]

  it.each(allKeys)('%s has a translated string in es and en', (key) => {
    expect(typeof es.marketAnalysis[key]).toBe('string')
    expect(typeof en.marketAnalysis[key]).toBe('string')
  })

  it('every reading function only ever returns keys covered above', () => {
    const produced = new Set<ReadingKey>([
      signalFor(0.8).key,
      signalFor(0.2).key,
      signalFor(0).key,
      signalFor(-0.2).key,
      signalFor(-0.8).key,
      signalFor(null).key,
      rsiReading(80).key,
      rsiReading(20).key,
      rsiReading(50).key,
      rsiReading(0).key,
      macdReading(2, 1).key,
      macdReading(1, 2).key,
      macdReading(1, 1).key,
      macdReading(null, null).key,
      adxReading(30).key,
      adxReading(22).key,
      adxReading(10).key,
      adxReading(0).key,
    ])
    for (const key of produced) expect(allKeys).toContain(key)
  })
})
