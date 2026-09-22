'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

interface EconomicEvent {
  time: string
  country: string
  event: string
  impact: string
  actual: number | null
  estimate: number | null
  previous: number | null
  unit: string
}

const IMPACT_COLOR: Record<string, string> = {
  high: 'bg-semantic-danger',
  medium: 'bg-semantic-warning',
}

const IMPACT_LABEL: Record<string, string> = {
  high: 'Alto impacto',
  medium: 'Impacto medio',
}

function formatValue(value: number | null, unit: string): string {
  if (value === null) return '—'
  return `${value}${unit && unit !== '%' ? ` ${unit}` : unit}`
}

function toDate(time: string): Date {
  return new Date(time.replace(' ', 'T'))
}

function formatDay(time: string): string {
  const date = toDate(time)
  if (Number.isNaN(date.getTime())) return time
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatTime(time: string): string {
  const date = toDate(time)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/economic-calendar', { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (body.success) setEvents(body.data)
        else setFailed(true)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [])

  if (failed || events?.length === 0) return null

  const groups = new Map<string, EconomicEvent[]>()
  for (const event of events ?? []) {
    const day = event.time.slice(0, 10)
    const list = groups.get(day) ?? []
    list.push(event)
    groups.set(day, list)
  }

  return (
    <section aria-labelledby="calendar-heading">
      <h2 id="calendar-heading" className="text-[22px] font-semibold tracking-tight text-ink">
        Calendario económico
      </h2>
      <p className="mb-8 mt-1 max-w-2xl text-[14px] text-ink-muted">Próximos eventos macroeconómicos de mayor impacto para los próximos 7 días.</p>

      {events === null ? (
        <p className="text-[13px] text-ink-muted">Cargando…</p>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([day, dayEvents]) => (
            <div key={day}>
              <h3 className="mb-2 text-[13px] font-semibold capitalize text-ink">{formatDay(dayEvents[0].time)}</h3>
              <ul>
                {dayEvents.map((event, index) => (
                  <li key={`${day}-${index}`} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-4 border-b border-hairline-soft py-3 last:border-b-0">
                    <span className="text-[12px] tabular-nums text-ink-subtle">{formatTime(event.time)}</span>
                    <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
                      <span className={clsx('size-1.5 shrink-0 rounded-full', IMPACT_COLOR[event.impact] ?? 'bg-ink-subtle')} aria-hidden="true" />
                      <span className="shrink-0 text-[11px] uppercase text-ink-subtle">{event.country}</span>
                      <span className="truncate">{event.event}</span>
                      <span className="sr-only">{IMPACT_LABEL[event.impact] ?? ''}</span>
                    </span>
                    <span className="text-right text-[12px] tabular-nums text-ink-muted">
                      {formatValue(event.actual, event.unit)}
                      {event.estimate !== null && <span className="ml-1 text-ink-subtle">(est. {formatValue(event.estimate, event.unit)})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] text-ink-subtle">Fuente: Finnhub.</p>
    </section>
  )
}
