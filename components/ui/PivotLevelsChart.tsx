'use client'

import { clsx } from 'clsx'
import { formatPrice } from '@/lib/format'

interface PivotLevelsChartProps {
  close: number
  levels: {
    r3: number
    r2: number
    r1: number
    pivot: number
    s1: number
    s2: number
    s3: number
  }
  symbol: string
}

export function PivotLevelsChart({ close, levels, symbol }: PivotLevelsChartProps) {
  const allValues = [levels.s3, levels.s2, levels.s1, levels.pivot, levels.r1, levels.r2, levels.r3, close]
  const minVal = Math.min(...allValues)
  const maxVal = Math.max(...allValues)
  const range = maxVal - minVal || 1

  const getPosition = (value: number) => {
    return ((value - minVal) / range) * 100
  }

  const isAbovePivot = close >= levels.pivot

  const levelItems = [
    { label: 'R3', value: levels.r3, color: 'bg-semantic-success', textColor: 'text-semantic-success', side: 'right' as const },
    { label: 'R2', value: levels.r2, color: 'bg-semantic-success', textColor: 'text-semantic-success', side: 'right' as const },
    { label: 'R1', value: levels.r1, color: 'bg-semantic-success', textColor: 'text-semantic-success', side: 'right' as const },
    { label: 'PP', value: levels.pivot, color: 'bg-accent-blue', textColor: 'text-accent-blue', side: 'right' as const, main: true },
    { label: 'S1', value: levels.s1, color: 'bg-semantic-danger', textColor: 'text-semantic-danger', side: 'right' as const },
    { label: 'S2', value: levels.s2, color: 'bg-semantic-danger', textColor: 'text-semantic-danger', side: 'right' as const },
    { label: 'S3', value: levels.s3, color: 'bg-semantic-danger', textColor: 'text-semantic-danger', side: 'right' as const },
  ]

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-headline font-bold text-ink">Niveles del Día</h3>
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full bg-semantic-success" />
          <span className="text-micro text-ink-muted">Resistencia</span>
          <span className="inline-block size-2 rounded-full bg-accent-blue ml-2" />
          <span className="text-micro text-ink-muted">Pivot</span>
          <span className="inline-block size-2 rounded-full bg-semantic-danger ml-2" />
          <span className="text-micro text-ink-muted">Soporte</span>
        </div>
      </div>

      <div className="relative" style={{ height: 320 }}>
        {/* Vertical bar */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-outline-variant/40 -translate-x-1/2" />

        {/* Current price line */}
        <div
          className="absolute left-0 right-0 z-20"
          style={{ bottom: `${getPosition(close)}%` }}
        >
          <div className={clsx('absolute -left-1 -right-1 h-0.5', isAbovePivot ? 'bg-semantic-success' : 'bg-semantic-danger')} />
          <div className="absolute -right-2 -translate-y-1/2 top-1/2">
            <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', isAbovePivot ? 'bg-semantic-success/15 text-semantic-success' : 'bg-semantic-danger/15 text-semantic-danger')}>
              {formatPrice(close, symbol, { forexDecimals: 4 })}
            </span>
          </div>
          <span className="absolute -left-16 -translate-y-1/2 top-1/2 text-[10px] font-bold text-ink-muted">ACTUAL</span>
        </div>

        {/* Level markers */}
        {levelItems.map((level) => {
          const pos = getPosition(level.value)
          return (
            <div
              key={level.label}
              className="absolute left-0 right-0 z-10"
              style={{ bottom: `${pos}%` }}
            >
              <div className={clsx('absolute left-1/2 -translate-x-1/2 -left-4 w-2 h-2 rounded-full -translate-y-1/2 top-1/2', level.color, level.main && 'ring-2 ring-accent-blue/30')} />
              <div className={clsx('absolute -translate-y-1/2 top-1/2 text-[11px] font-bold', level.side === 'right' ? 'right-0' : 'left-0', level.textColor)}>
                <span className="font-mono tabular-nums">{formatPrice(level.value, symbol, { forexDecimals: 4 })}</span>
                <span className={clsx('ml-2 text-ink-muted', level.main && 'text-accent-blue')}>{level.label}</span>
              </div>
              <div className={clsx('absolute left-1/2 h-px -translate-x-1/2', level.main ? 'bg-accent-blue/30 w-full' : 'bg-outline-variant/30 w-3/4')} />
            </div>
          )
        })}
      </div>

      {/* Info bar */}
      <div className="mt-6 pt-4 border-t border-outline-variant/40 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-micro text-ink-muted">Dist. a R1</p>
          <p className="text-sm font-bold text-semantic-success font-mono tabular-nums">
            {((levels.r1 - close) / close * 100).toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-micro text-ink-muted">Posición</p>
          <p className={clsx('text-sm font-bold', isAbovePivot ? 'text-semantic-success' : 'text-semantic-danger')}>
            {isAbovePivot ? 'Sobre Pivot' : 'Bajo Pivot'}
          </p>
        </div>
        <div>
          <p className="text-micro text-ink-muted">Dist. a S1</p>
          <p className="text-sm font-bold text-semantic-danger font-mono tabular-nums">
            {((close - levels.s1) / close * 100).toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  )
}
