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
import { PivotLadder } from './PivotLadder'

// lightweight-charts touches the DOM, so it stays out of the server render and the initial bundle
const MarketChart = dynamic(() => import('./MarketChart').then((mod) => mod.MarketChart), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] animate-pulse motion-reduce:animate-none rounded-xl bg-surface-2" role="status" aria-live="polite">
      <span className="sr-only">Cargando gráfico…</span>
    </div>
  ),
})

// Candle size that lets a few periods of the chosen pivot timeframe show up on screen
const INITIAL_TIMEFRAME: Record<PivotTimeframe, TimeframeKey> = { D: '1h', W: '1d', M: '1w' }
const CHART_COLOR = { resistance: '#22c55e', pivot: '#0099ff', support: '#ff3b30' } as const

type View = 'ladder' | 'candles'

const BIAS = {
  bullish: { label: 'Alcista', hint: 'Precio sobre el pivote', className: 'text-semantic-success' },
  bearish: { label: 'Bajista', hint: 'Precio bajo el pivote', className: 'text-semantic-danger' },
  neutral: { label: 'Neutral', hint: 'Precio en el pivote', className: 'text-ink-muted' },
} as const

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
  const [view, setView] = useState<View>('ladder')

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

  const bias = BIAS[position.bias]
  const changeUp = quote.change >= 0

  return (
    <section
      className={clsx('rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5', className)}
      aria-label={`Niveles de ${asset.name}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-subhead font-bold text-ink">{asset.name}</h2>
          <p className="text-micro text-ink-muted">
            {asset.label} · {PIVOT_METHOD_INFO[method].label} · {periodLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-headline tabular-nums text-ink">{formatLevel(price, price, asset.tv)}</p>
          <p className={clsx('font-mono text-micro font-semibold tabular-nums', changeUp ? 'text-semantic-success' : 'text-semantic-danger')}>
            {signed(quote.change)} hoy
          </p>
        </div>
      </div>

      <div role="group" aria-label="Tipo de gráfico" className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-0.5">
        {(
          [
            { key: 'ladder', label: 'Escalera de niveles', icon: 'stacked_bar_chart' },
            { key: 'candles', label: 'Velas', icon: 'candlestick_chart' },
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
          <dt className="text-micro text-ink-muted">Sesgo</dt>
          <dd className={clsx('text-body-sm font-bold', bias.className)}>{bias.label}</dd>
          <dd className="text-[10px] text-ink-subtle">{bias.hint}</dd>
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">Zona actual</dt>
          <dd className="text-body-sm font-bold text-ink">{position.zone}</dd>
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">Resistencia próxima</dt>
          {position.resistance ? (
            <>
              <dd className="font-mono text-body-sm font-bold tabular-nums text-semantic-success">
                {position.resistance.label} · {formatLevel(position.resistance.value, price, asset.tv)}
              </dd>
              <dd className="font-mono text-[10px] tabular-nums text-ink-muted">{signed(distancePct(position.resistance.value, price))}</dd>
            </>
          ) : (
            <dd className="text-body-sm text-ink-muted">Sin resistencia por encima</dd>
          )}
        </div>
        <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
          <dt className="text-micro text-ink-muted">Soporte próximo</dt>
          {position.support ? (
            <>
              <dd className="font-mono text-body-sm font-bold tabular-nums text-semantic-danger">
                {position.support.label} · {formatLevel(position.support.value, price, asset.tv)}
              </dd>
              <dd className="font-mono text-[10px] tabular-nums text-ink-muted">{signed(distancePct(position.support.value, price))}</dd>
            </>
          ) : (
            <dd className="text-body-sm text-ink-muted">Sin soporte por debajo</dd>
          )}
        </div>
      </dl>

      <p className="mt-4 border-t border-hairline-soft pt-3 font-mono text-[10px] leading-relaxed text-ink-subtle">
        Calculado con la {periodLabel}: H {formatLevel(previous.high, price, asset.tv)} · L {formatLevel(previous.low, price, asset.tv)} · C{' '}
        {formatLevel(previous.close, price, asset.tv)}
      </p>
    </section>
  )
}
