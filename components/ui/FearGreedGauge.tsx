'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary } from '@/lib/i18n/LocaleProvider'

type FearGreedKind = 'crypto' | 'stocks'

const ENDPOINT: Record<FearGreedKind, string> = {
  crypto: '/api/fear-greed',
  stocks: '/api/fear-greed-stocks',
}

type FearGreedDict = ReturnType<typeof useDictionary>['fearGreed']

const COMPONENT_LABELS: Record<string, (dict: FearGreedDict) => string> = {
  momentum: (dict) => dict.componentMomentum,
  volatility: (dict) => dict.componentVolatility,
  safeHaven: (dict) => dict.componentSafeHaven,
  junkBonds: (dict) => dict.componentJunkBonds,
}

interface FearGreedComponent {
  key: string
  score: number
}

// `compact` es la versión del portal de inicio: sin encabezado grande ni nota de escala larga
export function FearGreedGauge({ kind = 'crypto', compact = false }: { kind?: FearGreedKind; compact?: boolean }) {
  const dict = useDictionary().fearGreed
  const ZONES = [
    { max: 25, label: dict.extremeFear, color: 'var(--semantic-danger)' },
    { max: 45, label: dict.fear, color: 'var(--gradient-orange)' },
    { max: 55, label: dict.neutral, color: 'var(--semantic-warning)' },
    { max: 75, label: dict.greed, color: 'var(--accent-blue)' },
    { max: 100, label: dict.extremeGreed, color: 'var(--semantic-success)' },
  ]
  const zoneFor = (value: number) => ZONES.find((zone) => value <= zone.max) ?? ZONES[ZONES.length - 1]

  const [value, setValue] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const [components, setComponents] = useState<FearGreedComponent[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetch(ENDPOINT[kind], { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (body.success) {
          setValue(body.value)
          if (Array.isArray(body.components)) setComponents(body.components)
        }
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [kind])

  if (failed) return null

  const heading = kind === 'stocks' ? dict.headingStocks : dict.heading
  const scaleNote = kind === 'stocks' ? dict.scaleNoteStocks : dict.scaleNote
  const zone = value === null ? null : zoneFor(value)
  // Half-circle gauge: 0 maps to the left end, 100 to the right end
  const angle = value === null ? 0 : (value / 100) * Math.PI
  const needleX = 60 - 42 * Math.cos(angle)
  const needleY = 60 - 42 * Math.sin(angle)

  return (
    <section aria-label={heading}>
      <h3 className={clsx('text-[13px] font-semibold text-ink', compact ? 'mb-2' : 'mb-3')}>{heading}</h3>
      <div className="flex items-center gap-4" role={value === null ? 'status' : undefined} aria-live={value === null ? 'polite' : undefined}>
        <svg
          viewBox="0 0 120 70"
          className={clsx('h-14 w-24 shrink-0', value === null && 'animate-pulse motion-reduce:animate-none')}
          role="img"
          aria-label={value === null ? dict.gaugeAriaLoading : t(dict.gaugeAriaValue, { value })}
        >
          <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="var(--hairline)" strokeWidth="8" strokeLinecap="round" />
          {value !== null && zone && (
            <path
              d="M 10 60 A 50 50 0 0 1 110 60"
              fill="none"
              stroke={zone.color}
              strokeWidth="8"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${value} 100`}
            />
          )}
          {value !== null && <line x1="60" y1="60" x2={needleX} y2={needleY} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />}
          <circle cx="60" cy="60" r="3.5" fill="var(--ink)" />
        </svg>

        <div>
          {value === null ? (
            <>
              <div aria-hidden="true" className="h-7 w-10 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
              <div aria-hidden="true" className="mt-1.5 h-3 w-20 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
              <span className="sr-only">{dict.loadingLabel}</span>
            </>
          ) : (
            <>
              <p className="text-[28px] font-semibold leading-none tabular-nums text-ink">{value}</p>
              <p className="mt-1 text-[13px]" style={{ color: zone?.color }}>
                {zone?.label}
              </p>
            </>
          )}
        </div>
      </div>
      {!compact && components.length > 0 && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[12px]" aria-label={dict.componentsTitle}>
          {components.map((component) => (
            <div key={component.key} className="contents">
              <dt className="text-ink-muted">{COMPONENT_LABELS[component.key]?.(dict) ?? component.key}</dt>
              <dd className="tabular-nums text-ink">{Math.round(component.score)}</dd>
            </div>
          ))}
        </dl>
      )}
      {(!compact || kind === 'stocks') && <p className="mt-2 text-[12px] text-ink-subtle">{scaleNote}</p>}
    </section>
  )
}
