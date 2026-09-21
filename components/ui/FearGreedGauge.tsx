'use client'

import { useEffect, useState } from 'react'

const ZONES = [
  { max: 25, label: 'Miedo extremo', color: 'var(--semantic-danger)' },
  { max: 45, label: 'Miedo', color: 'var(--gradient-orange)' },
  { max: 55, label: 'Neutral', color: 'var(--semantic-warning)' },
  { max: 75, label: 'Codicia', color: 'var(--accent-blue)' },
  { max: 100, label: 'Codicia extrema', color: 'var(--semantic-success)' },
]

function zoneFor(value: number) {
  return ZONES.find((zone) => value <= zone.max) ?? ZONES[ZONES.length - 1]
}

export function FearGreedGauge() {
  const [value, setValue] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/fear-greed', { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (body.success) setValue(body.value)
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])

  if (failed) return null

  const zone = value === null ? null : zoneFor(value)
  // Half-circle gauge: 0 maps to the left end, 100 to the right end
  const angle = value === null ? 0 : (value / 100) * Math.PI
  const needleX = 60 - 42 * Math.cos(angle)
  const needleY = 60 - 42 * Math.sin(angle)

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3">
      <svg viewBox="0 0 120 70" className="h-14 w-24 shrink-0" role="img" aria-label={value === null ? 'Índice de miedo y codicia' : `Índice de miedo y codicia: ${value} de 100`}>
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="var(--hairline)" strokeWidth="10" strokeLinecap="round" />
        {value !== null && zone && (
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={zone.color}
            strokeWidth="10"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${value} 100`}
          />
        )}
        {value !== null && <line x1="60" y1="60" x2={needleX} y2={needleY} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />}
        <circle cx="60" cy="60" r="4" fill="var(--ink)" />
      </svg>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Miedo y codicia (cripto)</p>
        {value === null ? (
          <p className="text-body-sm text-ink-muted">Cargando…</p>
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-headline font-bold tabular-nums text-ink">{value}</span>
            <span className="text-body-sm font-medium" style={{ color: zone?.color }}>
              {zone?.label}
            </span>
          </p>
        )}
        <p className="text-[10px] text-ink-subtle">Fuente: alternative.me</p>
      </div>
    </div>
  )
}
