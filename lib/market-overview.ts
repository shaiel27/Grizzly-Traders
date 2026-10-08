import { getDictionary, t, type Locale } from './i18n/get-dictionary'
import { MARKET_CATEGORY_LABELS, type MarketCategory } from './market-assets'

// The overview only needs these fields, so it stays usable with any list of assets that has them
export interface OverviewAsset {
  symbol: string
  name: string
  category: string
  change: number
}

const hasChange = <T extends OverviewAsset>(asset: T): boolean => Number.isFinite(asset.change)

export interface MarketSummary {
  total: number
  up: number
  down: number
  flat: number
  // Mean daily change of every asset, in %
  average: number
}

export function summarizeMarket(assets: OverviewAsset[]): MarketSummary {
  const valid = assets.filter(hasChange)
  const up = valid.filter((asset) => asset.change > 0).length
  const down = valid.filter((asset) => asset.change < 0).length
  const average = valid.length ? valid.reduce((sum, asset) => sum + asset.change, 0) / valid.length : 0
  return { total: valid.length, up, down, flat: valid.length - up - down, average }
}

// One plain sentence that answers "how is the market today?"
export function marketHeadline({ total, up, down }: MarketSummary, locale: Locale = 'es'): string {
  const dict = getDictionary(locale).marketOverview
  if (total === 0) return dict.headlineEmpty
  if (up / total >= 0.6) return t(dict.headlineUp, { up, total })
  if (down / total >= 0.6) return t(dict.headlineDown, { down, total })
  return t(dict.headlineMixed, { up, down })
}

export interface HistogramBin {
  from: number
  to: number
  count: number
  // The outer bins also collect everything beyond the range
  label: string
}

// Counts assets by daily change in `step`-wide bins between `min` and `max`; larger moves fall into the outer bins
export function changeHistogram(assets: OverviewAsset[], locale: Locale = 'es', min = -5, max = 5, step = 1): HistogramBin[] {
  const dict = getDictionary(locale).marketOverview
  const bins = Math.round((max - min) / step)
  const counts = new Array<number>(bins).fill(0)

  for (const asset of assets.filter(hasChange)) {
    const index = Math.min(bins - 1, Math.max(0, Math.floor((asset.change - min) / step)))
    counts[index] += 1
  }

  const fmt = (value: number) => `${value > 0 ? '+' : ''}${value}`
  return counts.map((count, index) => {
    const from = min + index * step
    const to = from + step
    const label =
      index === 0
        ? t(dict.binLessOrEqual, { x: fmt(to) })
        : index === bins - 1
          ? t(dict.binMoreOrEqual, { x: fmt(from) })
          : t(dict.binRange, { from: fmt(from), to: fmt(to) })
    return { from, to, count, label }
  })
}

export interface CategorySummary extends MarketSummary {
  category: MarketCategory
  label: string
  best: OverviewAsset | null
  worst: OverviewAsset | null
}

// One entry per category that has data, best average first
export function summarizeCategories(assets: OverviewAsset[]): CategorySummary[] {
  return (Object.keys(MARKET_CATEGORY_LABELS) as MarketCategory[])
    .map((category) => {
      const members = assets.filter((asset) => asset.category === category && hasChange(asset))
      const sorted = [...members].sort((a, b) => b.change - a.change)
      return {
        ...summarizeMarket(members),
        category,
        label: MARKET_CATEGORY_LABELS[category],
        best: sorted[0] ?? null,
        worst: sorted.length > 1 ? sorted[sorted.length - 1] : null,
      }
    })
    .filter((summary) => summary.total > 0)
    .sort((a, b) => b.average - a.average)
}

// Half-width (in %) of the diverging bars: the largest average, but never below 1% so quiet days don't look dramatic
export function barScale(summaries: { average: number }[]): number {
  return Math.max(1, ...summaries.map((summary) => Math.abs(summary.average)))
}
