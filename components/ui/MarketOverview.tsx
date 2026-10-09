'use client'

import { useMemo } from 'react'
import { clsx } from 'clsx'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import type { MarketCategory } from '@/lib/market-assets'
import type { MarketItem } from '@/lib/markets'
import { barScale, changeHistogram, marketHeadline, summarizeCategories, summarizeMarket } from '@/lib/market-overview'
import { FearGreedGauge } from './FearGreedGauge'
import { TopMovers } from './TopMovers'

interface MarketOverviewProps {
  assets: MarketItem[]
  onSelect: (asset: MarketItem) => void
  onSelectCategory: (category: MarketCategory) => void
}

// Height in px of the tallest bar of the distribution
const BAR_AREA = 72

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function tone(value: number): string {
  return value > 0 ? 'text-semantic-success' : value < 0 ? 'text-semantic-danger' : 'text-ink-muted'
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// How today's changes are spread: most assets cluster near zero, and the tails show where the action is
function Distribution({ assets }: { assets: MarketItem[] }) {
  const { locale } = useLocale()
  const dict = useDictionary().marketOverview
  const bins = useMemo(() => changeHistogram(assets, locale), [assets, locale])
  const peak = Math.max(1, ...bins.map((bin) => bin.count))
  const total = bins.reduce((sum, bin) => sum + bin.count, 0)

  return (
    <figure>
      <div className="relative flex gap-1" role="img" aria-label={t(dict.distributionAria, { total })}>
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-hairline" aria-hidden="true" />
        {bins.map((bin) => (
          <div
            key={bin.from}
            className="flex flex-1 flex-col items-center justify-end gap-1.5"
            style={{ height: BAR_AREA + 20 }}
            title={t(dict.distributionTooltip, { label: bin.label, count: bin.count, unit: bin.count === 1 ? dict.unitAsset : dict.unitAssets })}
          >
            <span className="text-[11px] tabular-nums text-ink-muted">{bin.count > 0 ? bin.count : ''}</span>
            <span
              className={clsx('w-full rounded-t-[3px]', bin.from >= 0 ? 'bg-semantic-success' : 'bg-semantic-danger', bin.count === 0 && 'opacity-20')}
              style={{ height: bin.count > 0 ? Math.max(3, Math.round((bin.count / peak) * BAR_AREA)) : 2 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 text-[12px] tabular-nums text-ink-subtle" aria-hidden="true">
        <span>{dict.distributionAxisLow}</span>
        <span className="text-center">{dict.distributionAxisMid}</span>
        <span className="text-right">{dict.distributionAxisHigh}</span>
      </div>
      <figcaption className="mt-4 text-[12px] text-ink-muted">{t(dict.distributionCaption, { total })}</figcaption>
    </figure>
  )
}

type BarLayout = 'both' | 'positive' | 'negative'

// With gains and losses the zero line sits in the middle; when every category moves the same way, the bars use the
// whole track from the edge, instead of leaving half of it empty
function DivergingBar({ value, scale, layout }: { value: number; scale: number; layout: BarLayout }) {
  const share = Math.min(1, Math.abs(value) / scale)
  const width = `${share * (layout === 'both' ? 50 : 100)}%`
  const style =
    layout === 'both'
      ? value >= 0
        ? { left: '50%', width }
        : { right: '50%', width }
      : layout === 'positive'
        ? { left: 0, width }
        : { right: 0, width }

  return (
    <span className="relative block h-2" aria-hidden="true">
      <span className={clsx('absolute inset-y-0 w-px bg-hairline', layout === 'both' ? 'left-1/2' : layout === 'positive' ? 'left-0' : 'right-0')} />
      <span className={clsx('absolute inset-y-0 rounded-[2px]', value >= 0 ? 'bg-semantic-success' : 'bg-semantic-danger')} style={style} />
    </span>
  )
}

export function MarketOverview({ assets, onSelect, onSelectCategory }: MarketOverviewProps) {
  const { locale } = useLocale()
  const dict = useDictionary().marketOverview
  const summary = useMemo(() => summarizeMarket(assets), [assets])
  const categories = useMemo(() => summarizeCategories(assets, locale), [assets, locale])
  const scale = barScale(categories)
  const layout: BarLayout = categories.every((item) => item.average >= 0) ? 'positive' : categories.every((item) => item.average <= 0) ? 'negative' : 'both'

  if (summary.total === 0) return null

  return (
    <div className="space-y-16">
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="text-[34px] font-semibold leading-[1.12] tracking-tight text-ink">{marketHeadline(summary, locale)}</p>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <dt className="text-[13px] text-ink-muted">{dict.avgChangeLabel}</dt>
              <dd className={clsx('text-[22px] font-semibold tabular-nums', tone(summary.average))}>{signed(summary.average)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-muted">{dict.upLabel}</dt>
              <dd className="text-[22px] font-semibold tabular-nums text-semantic-success">{summary.up}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-ink-muted">{dict.downLabel}</dt>
              <dd className="text-[22px] font-semibold tabular-nums text-semantic-danger">{summary.down}</dd>
            </div>
          </dl>
        </div>

        <Distribution assets={assets} />
      </div>

      <div className="grid gap-x-20 gap-y-14 border-t border-hairline pt-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section aria-labelledby="overview-categories-heading">
          <h3 id="overview-categories-heading" className="text-[15px] font-semibold text-ink">
            {dict.byCategoryHeading}
          </h3>
          <p className="mb-2 mt-1 text-[13px] text-ink-muted">{dict.byCategorySubtitle}</p>

          <ul>
            {categories.map((item) => (
              <li key={item.category} className="border-b border-hairline-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelectCategory(item.category)}
                  aria-label={t(dict.viewCategoryAria, { label: item.label })}
                  className="group grid w-full grid-cols-[7.25rem_minmax(0,1fr)_4.75rem] items-center gap-x-5 gap-y-1.5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue"
                >
                  <span className="text-[14px] font-medium text-ink group-hover:text-accent-blue">{item.label}</span>
                  <DivergingBar value={item.average} scale={scale} layout={layout} />
                  <span className={clsx('text-right text-[15px] font-semibold tabular-nums', tone(item.average))}>{signed(item.average)}</span>

                  <span className="col-start-2 col-end-4 flex flex-wrap gap-x-5 gap-y-0.5 text-[12px] tabular-nums text-ink-muted">
                    <span>{plural(item.up, dict.upOne, dict.upMany)}</span>
                    <span>{plural(item.down, dict.downOne, dict.downMany)}</span>
                    {item.best && (
                      <span className="hidden sm:inline">
                        {t(dict.bestMover, { name: item.best.name })} <span className={tone(item.best.change)}>{signed(item.best.change)}</span>
                      </span>
                    )}
                    {item.worst && (
                      <span className="hidden sm:inline">
                        {t(dict.worstMover, { name: item.worst.name })} <span className={tone(item.worst.change)}>{signed(item.worst.change)}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-12">
          <TopMovers assets={assets} onSelect={onSelect} className="grid gap-x-10 gap-y-9 sm:grid-cols-2" />
          <FearGreedGauge />
        </div>
      </div>
    </div>
  )
}
