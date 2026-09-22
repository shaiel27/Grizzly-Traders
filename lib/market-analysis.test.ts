import { describe, expect, it } from 'vitest'
import { adxReading, compareWithAverages, macdReading, rangePosition, rsiReading, signalFor } from './market-analysis'

describe('signalFor', () => {
  it.each([
    [0.8, 'Compra fuerte', 'positive'],
    [0.5, 'Compra fuerte', 'positive'],
    [0.2, 'Compra', 'positive'],
    [0.1, 'Compra', 'positive'],
    [0.05, 'Neutral', 'neutral'],
    [-0.05, 'Neutral', 'neutral'],
    [-0.1, 'Venta', 'negative'],
    [-0.5, 'Venta fuerte', 'negative'],
  ])('reads %d as %s', (value, label, tone) => {
    expect(signalFor(value)).toEqual({ label, tone })
  })

  it('handles missing values', () => {
    expect(signalFor(null).label).toBe('Sin datos')
    expect(signalFor(NaN).label).toBe('Sin datos')
  })
})

describe('rsiReading', () => {
  it('flags overbought and oversold levels', () => {
    expect(rsiReading(72)).toEqual({ label: 'Sobrecompra', tone: 'negative' })
    expect(rsiReading(28)).toEqual({ label: 'Sobreventa', tone: 'positive' })
    expect(rsiReading(50).tone).toBe('neutral')
  })

  it('treats a missing or zero RSI as no data', () => {
    expect(rsiReading(0).label).toBe('Sin datos')
    expect(rsiReading(undefined).label).toBe('Sin datos')
  })
})

describe('macdReading', () => {
  it('compares the MACD line with its signal', () => {
    expect(macdReading(2, 1).tone).toBe('positive')
    expect(macdReading(1, 2).tone).toBe('negative')
    expect(macdReading(1, 1).tone).toBe('neutral')
    expect(macdReading(null, 1).label).toBe('Sin datos')
  })
})

describe('adxReading', () => {
  it('describes trend strength without taking a side', () => {
    expect(adxReading(30).label).toBe('Tendencia fuerte')
    expect(adxReading(22).label).toBe('Tendencia moderada')
    expect(adxReading(15).label).toBe('Sin tendencia definida')
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
