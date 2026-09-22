import { describe, expect, it } from 'vitest'
import { barScale, changeHistogram, marketHeadline, summarizeCategories, summarizeMarket, type OverviewAsset } from './market-overview'

const asset = (symbol: string, category: string, change: number): OverviewAsset => ({ symbol, name: symbol, category, change })

const sample = [
  asset('BTC', 'crypto', 6),
  asset('ETH', 'crypto', 4),
  asset('SOL', 'crypto', -1),
  asset('EUR', 'forex', 0.1),
  asset('GBP', 'forex', -0.1),
  asset('GOLD', 'commodity', -0.5),
  asset('BAD', 'stock', NaN),
]

describe('summarizeMarket', () => {
  it('counts risers, fallers and flat assets and ignores missing changes', () => {
    const summary = summarizeMarket([...sample, asset('FLAT', 'index', 0)])
    expect(summary).toMatchObject({ total: 7, up: 3, down: 3, flat: 1 })
    expect(summary.average).toBeCloseTo((6 + 4 - 1 + 0.1 - 0.1 - 0.5 + 0) / 7)
  })

  it('handles an empty list', () => {
    expect(summarizeMarket([])).toEqual({ total: 0, up: 0, down: 0, flat: 0, average: 0 })
  })
})

describe('marketHeadline', () => {
  const summary = (up: number, down: number, total: number) => ({ total, up, down, flat: total - up - down, average: 0 })

  it('says which side dominates once it holds 60% of the assets', () => {
    expect(marketHeadline(summary(46, 15, 64))).toBe('Hoy suben 46 de 64 activos')
    expect(marketHeadline(summary(10, 50, 64))).toBe('Hoy bajan 50 de 64 activos')
  })

  it('calls a balanced market divided', () => {
    expect(marketHeadline(summary(30, 30, 64))).toBe('El mercado está dividido: 30 suben y 30 bajan')
  })

  it('does not invent a reading without data', () => {
    expect(marketHeadline(summary(0, 0, 0))).toBe('Sin datos de mercado por ahora')
  })
})

describe('changeHistogram', () => {
  it('builds ten one-percent bins between -5% and +5% by default', () => {
    const bins = changeHistogram(sample)
    expect(bins).toHaveLength(10)
    expect(bins[0].from).toBe(-5)
    expect(bins[9].to).toBe(5)
  })

  it('places each asset in the bin of its change and keeps the total', () => {
    const bins = changeHistogram(sample)
    // -1 -> [-1, 0) = bin 4; 0.1 -> [0, 1) = bin 5; -0.1 -> bin 4; -0.5 -> bin 4; 4 -> [4, 5) = bin 9
    expect(bins[4].count).toBe(3)
    expect(bins[5].count).toBe(1)
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(6)
  })

  it('folds moves beyond the range into the outer bins', () => {
    const bins = changeHistogram([asset('A', 'crypto', 14), asset('B', 'crypto', -22), asset('C', 'crypto', 5)])
    expect(bins[9].count).toBe(2)
    expect(bins[0].count).toBe(1)
  })

  it('labels the bins in plain language', () => {
    const bins = changeHistogram([])
    expect(bins[0].label).toBe('-4% o menos')
    expect(bins[5].label).toBe('0% a +1%')
    expect(bins[9].label).toBe('+4% o más')
  })
})

describe('summarizeCategories', () => {
  const result = summarizeCategories(sample)

  it('lists only categories with data, best average first', () => {
    expect(result.map((item) => item.category)).toEqual(['crypto', 'forex', 'commodity'])
  })

  it('reports the best and worst asset of each category', () => {
    const crypto = result[0]
    expect(crypto.best?.symbol).toBe('BTC')
    expect(crypto.worst?.symbol).toBe('SOL')
    expect(crypto).toMatchObject({ up: 2, down: 1, total: 3, label: 'Cripto' })
  })

  it('leaves the worst empty when a category has a single asset', () => {
    const commodity = result.find((item) => item.category === 'commodity')
    expect(commodity?.best?.symbol).toBe('GOLD')
    expect(commodity?.worst).toBeNull()
  })
})

describe('barScale', () => {
  it('follows the largest average but never drops below 1%', () => {
    expect(barScale([{ average: 5.02 }, { average: -0.4 }])).toBeCloseTo(5.02)
    expect(barScale([{ average: 0.2 }, { average: -0.3 }])).toBe(1)
    expect(barScale([])).toBe(1)
  })
})
