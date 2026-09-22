'use client'

import { useId, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { formatLevel } from '@/lib/format'
import { ladderDomain, spreadLabels } from '@/lib/pivot-layout'
import { analyzePosition, distancePct, type PivotLevel, type PivotLevelKind } from '@/lib/pivots'

interface PivotLadderProps {
  levels: PivotLevel[]
  price: number
  symbol?: string
  height?: number
  className?: string
}

const LABEL_GAP = 36
const CONNECTOR_WIDTH = 28

const KIND_COLOR: Record<PivotLevelKind, string> = {
  resistance: 'var(--semantic-success)',
  pivot: 'var(--accent-blue)',
  support: 'var(--semantic-danger)',
}

function signed(value: number, decimals = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// To-scale ladder: every level sits at its real price, labels are spread so clustered levels stay readable
export function PivotLadder({ levels, price, symbol = '', height = 400, className }: PivotLadderProps) {
  const gradientId = useId()
  const [active, setActive] = useState<string | null>(null)

  const layout = useMemo(() => {
    const domain = ladderDomain([...levels.map((level) => level.value), price])
    const y = (value: number) => ((domain.max - value) / (domain.max - domain.min)) * height
    const sorted = [...levels].sort((a, b) => b.value - a.value)
    const labelY = spreadLabels(
      sorted.map((level) => y(level.value)),
      LABEL_GAP,
      LABEL_GAP / 2,
      height - LABEL_GAP / 2
    )
    const position = analyzePosition(sorted, price)
    const pivot = sorted.find((level) => level.kind === 'pivot')
    return { y, sorted, labelY, position, pivotY: pivot ? y(pivot.value) : null }
  }, [levels, price, height])

  const { y, sorted, labelY, position, pivotY } = layout
  const priceY = y(price)
  const bandTop = position.resistance ? y(position.resistance.value) : 0
  const bandBottom = position.support ? y(position.support.value) : height
  const biasColor =
    position.bias === 'bullish' ? 'var(--semantic-success)' : position.bias === 'bearish' ? 'var(--semantic-danger)' : 'var(--ink-muted)'

  return (
    <div className={clsx('flex', className)} style={{ height }} role="group" aria-label="Escalera de niveles de pivote">
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl border border-hairline-soft bg-surface-1/40">
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${gradientId}-res`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--semantic-success)', stopOpacity: 0.2 }} />
              <stop offset="1" style={{ stopColor: 'var(--semantic-success)', stopOpacity: 0.02 }} />
            </linearGradient>
            <linearGradient id={`${gradientId}-sup`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--semantic-danger)', stopOpacity: 0.02 }} />
              <stop offset="1" style={{ stopColor: 'var(--semantic-danger)', stopOpacity: 0.2 }} />
            </linearGradient>
          </defs>

          {pivotY !== null && (
            <>
              <rect x="0" y="0" width="100" height={Math.max(0, pivotY)} fill={`url(#${gradientId}-res)`} />
              <rect x="0" y={pivotY} width="100" height={Math.max(0, height - pivotY)} fill={`url(#${gradientId}-sup)`} />
            </>
          )}

          <rect x="0" y={bandTop} width="100" height={Math.max(0, bandBottom - bandTop)} style={{ fill: 'var(--ink)', fillOpacity: 0.05 }} />

          {sorted.map((level) => (
            <line
              key={level.key}
              x1="0"
              x2="100"
              y1={y(level.value)}
              y2={y(level.value)}
              stroke={KIND_COLOR[level.kind]}
              strokeWidth={active === level.key ? 2.5 : level.kind === 'pivot' ? 1.5 : 1}
              strokeDasharray={level.kind === 'pivot' ? undefined : '5 4'}
              strokeOpacity={active === null || active === level.key ? 0.9 : 0.3}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <line x1="0" x2="100" y1={priceY} y2={priceY} stroke={biasColor} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>

        <div
          className="absolute left-2 z-10 -translate-y-1/2"
          style={{ top: Math.min(height - 14, Math.max(14, priceY)) }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full border bg-surface-container-lowest px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-ink shadow-lg"
            style={{ borderColor: biasColor }}
          >
            <span className="relative flex size-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: biasColor }} />
              <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: biasColor }} />
            </span>
            {formatLevel(price, price, symbol)}
          </span>
        </div>
      </div>

      <svg className="shrink-0" width={CONNECTOR_WIDTH} height={height} viewBox={`0 0 ${CONNECTOR_WIDTH} ${height}`} aria-hidden="true">
        {sorted.map((level, index) => (
          <polyline
            key={level.key}
            points={`0,${y(level.value)} 10,${labelY[index]} ${CONNECTOR_WIDTH},${labelY[index]}`}
            fill="none"
            stroke={KIND_COLOR[level.kind]}
            strokeWidth={active === level.key ? 2 : 1}
            strokeOpacity={active === null || active === level.key ? 0.7 : 0.2}
          />
        ))}
      </svg>

      <div className="relative w-40 shrink-0">
        {sorted.map((level, index) => {
          const distance = distancePct(level.value, price)
          const isNearest = position.resistance?.key === level.key || position.support?.key === level.key
          return (
            <button
              key={level.key}
              type="button"
              onMouseEnter={() => setActive(level.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(level.key)}
              onBlur={() => setActive(null)}
              title={`${level.label}: ${formatLevel(level.value, price, symbol)} (${signed(distance)} desde el precio)`}
              className={clsx(
                'absolute left-0 right-0 -translate-y-1/2 rounded-lg border px-2 py-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                active === level.key || isNearest ? 'border-hairline bg-surface-2' : 'border-transparent hover:bg-surface-2/60'
              )}
              style={{ top: labelY[index] }}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-bold" style={{ color: KIND_COLOR[level.kind] }}>
                  {level.label}
                </span>
                <span className="font-mono text-[12px] tabular-nums text-ink">{formatLevel(level.value, price, symbol)}</span>
              </span>
              <span className="block text-right font-mono text-[10px] tabular-nums text-ink-muted">{signed(distance)}</span>
            </button>
          )
        })}
      </div>

      <ul className="sr-only">
        {sorted.map((level) => (
          <li key={level.key}>
            {level.label}: {formatLevel(level.value, price, symbol)}, {signed(distancePct(level.value, price))} desde el precio actual
          </li>
        ))}
        <li>Precio actual: {formatLevel(price, price, symbol)}. {position.zone}.</li>
      </ul>
    </div>
  )
}
