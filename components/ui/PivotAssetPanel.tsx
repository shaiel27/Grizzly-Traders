'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { clsx } from 'clsx'
import { formatLevel } from '@/lib/format'
import type { PivotAsset } from '@/lib/pivot-assets'
import type { PivotQuote, PivotTimeframe } from '@/lib/pivot-data'
import { PIVOT_METHOD_INFO } from '@/lib/pivot-methods'
import { analyzePosition, calculatePivots, distancePct, levelsFor, type PivotMethod } from '@/lib/pivots'
import type { TimeframeKey } from '@/lib/candles'
import { t } from '@/lib/i18n/get-dictionary'
import { useLocale, useDictionary } from '@/lib/i18n/LocaleProvider'
import { PivotLadder } from './PivotLadder'

// next/dynamic renders `loading` as an ordinary component, so hooks work inside it — same pattern
// as MarketsClient.tsx's ChartLoading.
function ChartLoading() {
  const dict = useDictionary().pivotAssetPanel
  return (
    <div className="h-[480px] animate-pulse motion-reduce:animate-none rounded-xl bg-surface-2" role="status" aria-live="polite">
      <span className="sr-only">{dict.loadingChart}</span>
    </div>
  )
}

// lightweight-charts touches the DOM, so it stays out of the server render and the initial bundle
const MarketChart = dynamic(() => import('./MarketChart').then((mod) => mod.MarketChart), { ssr: false, loading: ChartLoading })

// Candle size that lets a few periods of the chosen pivot timeframe show up on screen
const INITIAL_TIMEFRAME: Record<PivotTimeframe, TimeframeKey> = { D: '1h', W: '1d', M: '1w' }
const CHART_COLOR = { resistance: '#22c55e', pivot: '#0099ff', support: '#ff3b30' } as const

type View = 'ladder' | 'candles'

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

interface PivotAssetPanelProps {
  asset: PivotAsset
  quote: PivotQuote
  method: PivotMethod
  timeframe: PivotTimeframe
  periodLabel: string
  className?: string
}

export function PivotAssetPanel({ asset, quote, method, timeframe, periodLabel, className }: PivotAssetPanelProps) {
  const { locale } = useLocale()
  const dict = useDictionary().pivotAssetPanel
  const zoneDict = useDictionary().pivotZone
  const [view, setView] = useState<View>('ladder')

  const BIAS = {
    bullish: { label: dict.biasBullish, hint: dict.biasBullishHint, className: 'text-semantic-success' },
    bearish: { label: dict.biasBearish, hint: dict.biasBearishHint, className: 'text-semantic-danger' },
    neutral: { label: dict.biasNeutral, hint: dict.biasNeutralHint, className: 'text-ink-muted' },
  } as const

  const { previous, price } = quote
  const levels = useMemo(
    () => levelsFor(calculatePivots(previous.high, previous.low, previous.close, previous.open), method),
    [previous, method]
  )
  const position = useMemo(() => analyzePosition(levels, price), [levels, price])
  const chartLevels = useMemo(
    () => levels.map((level) => ({ price: level.value, title: level.label, color: CHART_COLOR[level.kind] })),
    [levels]
  )
  const zoneText = t(zoneDict[position.zoneKind], { support: position.support?.label ?? '', resistance: position.resistance?.label ?? '' })

  const bias = BIAS[position.bias]
  const changeUp = quote.change >= 0
  const methodLabel = locale === 'en' ? PIVOT_METHOD_INFO[method].labelEn : PIVOT_METHOD_INFO[method].label

  return (
    <section
      className={clsx('rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5', className)}
      aria-label={t(dict.levelsOfAria, { name: asset.name })}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-subhead font-bold text-ink">{asset.name}</h2>
          <p className="text-micro text-ink-muted">
            {asset.label} · {methodLabel} · {periodLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-headline tabular-nums text-ink">{formatLevel(price, price, asset.tv)}</p>
          <p className={clsx('font-mono text-micro font-semibold tabular-nums', changeUp ? 'text-semantic-success' : 'text-semantic-danger')}>
            {signed(quote.change)} {dict.todaySuffix}
          </p>
        </div>
      </div>

      <div role="group" aria-label={dict.chartTypeAria} className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-0.5">
        {(
          [
            { key: 'ladder', label: dict.ladderView, icon: 'stacked_bar_chart' },
            { key: 'candles', label: dict.candlesView, icon: 'candlestick_chart' },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={view === option.key}
            onClick={() => setView(option.key)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors',
              view === option.key ? 'bg-surface-container-lowest text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            )}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {option.icon}
            </span>
            {option.label}
          </button>
        ))}
      </div>

      {view === 'ladder' ? (
        <PivotLadder levels={levels} price={price} symbol={asset.tv} />
      ) : (
        <MarketChart
          key={`${asset.tv}|${timeframe}`}
          bare
          symbol={asset.tv}
          name={asset.name}
          height={400}
          levels={chartLevels}
          initialTimeframe={INITIAL_TIMEFRAME[timeframe]}
        />
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">{dict.biasHeading}</dt>
          <dd className={clsx('text-body-sm font-bold', bias.className)}>{bias.label}</dd>
          <dd className="text-[10px] text-ink-subtle">{bias.hint}</dd>
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">{dict.currentZone}</dt>
          <dd className="text-body-sm font-bold text-ink">{zoneText}</dd>
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">{dict.nextResistance}</dt>
          {position.resistance ? (
            <>
              <dd className="font-mono text-body-sm font-bold tabular-nums text-semantic-success">
                {position.resistance.label} · {formatLevel(position.resistance.value, price, asset.tv)}
              </dd>
              <dd className="font-mono text-[10px] tabular-nums text-ink-muted">{signed(distancePct(position.resistance.value, price))}</dd>
            </>
          ) : (
            <dd className="text-body-sm text-ink-muted">{dict.noResistanceAbove}</dd>
          )}
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">{dict.nextSupport}</dt>
          {position.support ? (
            <>
              <dd className="font-mono text-body-sm font-bold tabular-nums text-semantic-danger">
                {position.support.label} · {formatLevel(position.support.value, price, asset.tv)}
              </dd>
              <dd className="font-mono text-[10px] tabular-nums text-ink-muted">{signed(distancePct(position.support.value, price))}</dd>
            </>
          ) : (
            <dd className="text-body-sm text-ink-muted">{dict.noSupportBelow}</dd>
          )}
        </div>
      </dl>

      <p className="mt-4 border-t border-hairline-soft pt-3 font-mono text-[10px] leading-relaxed text-ink-subtle">
        {t(dict.calculatedWith, {
          period: periodLabel,
          h: formatLevel(previous.high, price, asset.tv),
          l: formatLevel(previous.low, price, asset.tv),
          c: formatLevel(previous.close, price, asset.tv),
        })}
      </p>
    </section>
  )
}
