'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'

interface ForexEvent {
  id: string
  event_date: string
  event_time: string | null
  event_timestamp: string | null
  currency: string
  impact: string
  title: string
  actual: string | null
  actual_numeric: number | null
  forecast: string | null
  forecast_numeric: number | null
  previous: string | null
  unit: string | null
  is_all_day: boolean
}

const IMPACT_STYLES: Record<string, { dot: string; border: string; label: string }> = {
  high: { dot: 'bg-semantic-danger', border: 'border-l-semantic-danger', label: 'Alto impacto' },
  medium: { dot: 'bg-semantic-warning', border: 'border-l-semantic-warning', label: 'Impacto medio' },
  low: { dot: 'bg-ink-subtle', border: 'border-l-transparent', label: 'Impacto bajo' },
  holiday: { dot: 'bg-ink-subtle', border: 'border-l-transparent', label: 'Feriado' },
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD']

function impactStyle(impact: string) {
  return IMPACT_STYLES[impact] ?? IMPACT_STYLES.low
}

function eventDate(event: ForexEvent): Date | null {
  if (event.event_timestamp) {
    const d = new Date(event.event_timestamp)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function formatClock(event: ForexEvent): string {
  if (event.is_all_day) return 'Todo el día'
  const date = eventDate(event)
  if (!date) return event.event_time ?? '—'
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(event: ForexEvent): string {
  return event.event_date
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return 'en curso'
  const totalMinutes = Math.round(diffMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `en ${minutes} min`
  if (hours < 24) return minutes > 0 ? `en ${hours} h ${minutes} min` : `en ${hours} h`
  const days = Math.floor(hours / 24)
  return `en ${days} ${days === 1 ? 'día' : 'días'}`
}

function DeltaGlyph({ event }: { event: ForexEvent }) {
  if (event.actual_numeric === null || event.forecast_numeric === null) return null
  if (event.actual_numeric === event.forecast_numeric) return null
  const up = event.actual_numeric > event.forecast_numeric
  return (
    <span className={clsx('ml-1 text-[10px]', up ? 'text-accent-blue' : 'text-ink-subtle')} aria-hidden="true">
      {up ? '▲' : '▼'}
    </span>
  )
}

export function ForexCalendar({ headingLevel = 'h2' }: { headingLevel?: 'h1' | 'h2' }) {
  const Heading = headingLevel
  const [events, setEvents] = useState<ForexEvent[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/forex-calendar', { signal: controller.signal })
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

  // Countdown only needs to be roughly right, so a full re-render every 30s is enough and avoids a per-second clock.
  // `now` starts null (matches SSR) and is only ever set from a timer tick, never synchronously in the effect body.
  useEffect(() => {
    const tick = () => setNow(new Date())
    const interval = setInterval(tick, 30_000)
    const timeout = setTimeout(tick, 0)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  const availableCurrencies = useMemo(() => {
    const set = new Set((events ?? []).map((event) => event.currency))
    return CURRENCIES.filter((code) => set.has(code))
  }, [events])

  const filtered = useMemo(() => {
    if (!events) return []
    return activeCurrency ? events.filter((event) => event.currency === activeCurrency) : events
  }, [events, activeCurrency])

  const nextEvent = useMemo(() => {
    if (!now) return null
    return (
      filtered.find((event) => {
        const date = eventDate(event)
        return date && date.getTime() > now.getTime()
      }) ?? null
    )
  }, [filtered, now])

  const groups = useMemo(() => {
    const map = new Map<string, ForexEvent[]>()
    for (const event of filtered) {
      const key = dayKey(event)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <section aria-labelledby="forex-calendar-heading">
      {/* Un solo panel de consola con barra de estado, igual criterio que GRIZZLY://TERMINAL en
          HomeFeatures.tsx y la "consola de alertas" de VipShowcase.tsx: hairlines en vez de
          tarjetas sueltas, micro-etiquetas en mono, y el "❯" como marcador consistente. */}
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface-container-lowest">
        <div className="flex items-center justify-between border-b border-hairline-soft px-5 py-2.5 font-mono text-micro text-ink-subtle">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
            FOREXFACTORY://CALENDAR
          </span>
          {events !== null && !failed && <span className="tabular-nums">{filtered.length} eventos</span>}
        </div>

        <div className="px-5 py-6 md:px-8 md:py-8">
          <Heading id="forex-calendar-heading" className="text-headline text-ink">
            Calendario económico
          </Heading>
          <p className="mb-8 mt-1.5 max-w-2xl text-body-sm text-ink-muted">
            Publicaciones macro que mueven el mercado forex, con dato real, previsión y dato anterior.
          </p>

          {failed && <p className="text-body-sm text-ink-muted">No se pudo cargar el calendario económico. Intenta de nuevo en unos minutos.</p>}

          {!failed && events?.length === 0 && (
            <p className="text-body-sm text-ink-muted">No hay eventos económicos programados en las próximas 24 horas.</p>
          )}

          {!failed && events?.length !== 0 && (
            <>
              {events === null ? (
                <div role="status" aria-live="polite" className="space-y-8">
                  {[...Array(2)].map((_, groupIdx) => (
                    <div key={groupIdx} aria-hidden="true">
                      <div className="mb-2 h-4 w-28 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                      <ul>
                        {[...Array(4)].map((_, i) => (
                          <li
                            key={i}
                            className="grid grid-cols-[4.5rem_3rem_1fr_auto] items-center gap-4 border-b border-hairline-soft py-3 pl-3 last:border-b-0"
                          >
                            <div className="h-3 w-10 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                            <div className="h-3 w-8 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                            <div className="h-3 w-full max-w-[220px] animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                            <div className="h-3 w-14 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <span className="sr-only">Cargando calendario económico…</span>
                </div>
              ) : (
                <>
                  {nextEvent && now && (
                    <div
                      className={clsx(
                        'mb-8 flex flex-col gap-3 rounded-xl border border-hairline border-l-2 bg-surface-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
                        impactStyle(nextEvent.impact).border
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-micro text-ink-subtle">
                          <span className="text-accent-blue" aria-hidden="true">
                            ❯
                          </span>
                          Próximo evento
                          <span aria-hidden="true">·</span>
                          <span className="rounded-[4px] bg-surface-2 px-1.5 py-0.5 font-medium text-ink">{nextEvent.currency}</span>
                          <span>{impactStyle(nextEvent.impact).label}</span>
                        </div>
                        <p className="mt-1.5 truncate text-body font-medium text-ink">{nextEvent.title}</p>
                        {(nextEvent.forecast || nextEvent.previous) && (
                          <p className="mt-1 font-mono text-micro text-ink-muted">
                            {nextEvent.previous && <>anterior {nextEvent.previous}</>}
                            {nextEvent.previous && nextEvent.forecast && <span className="mx-1.5 text-ink-subtle">→</span>}
                            {nextEvent.forecast && <>previsto {nextEvent.forecast}</>}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-mono text-[20px] font-semibold tabular-nums text-accent-blue">
                          {(() => {
                            const date = eventDate(nextEvent)
                            return date ? formatCountdown(date, now) : ''
                          })()}
                        </p>
                        <p className="font-mono text-micro tabular-nums text-ink-subtle">{formatClock(nextEvent)}</p>
                      </div>
                    </div>
                  )}

                  {availableCurrencies.length > 1 && (
                    <div className="mb-6 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveCurrency(null)}
                        className={clsx(
                          'rounded-full border px-3 py-1 font-mono text-micro transition-colors',
                          activeCurrency === null ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-hairline text-ink-muted hover:border-ink-subtle'
                        )}
                      >
                        Todas
                      </button>
                      {availableCurrencies.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setActiveCurrency(code)}
                          className={clsx(
                            'rounded-full border px-3 py-1 font-mono text-micro transition-colors',
                            activeCurrency === code ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-hairline text-ink-muted hover:border-ink-subtle'
                          )}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-8">
                    {groups.map(([day, dayEvents]) => (
                      <div key={day}>
                        <h2 className="mb-2 flex items-center gap-1.5 text-caption font-semibold capitalize text-ink">
                          <span className="font-mono text-accent-blue" aria-hidden="true">
                            ❯
                          </span>
                          {formatDayLabel(day)}
                        </h2>
                        <ul>
                          {dayEvents.map((event) => (
                            <li
                              key={event.id}
                              className={clsx('grid grid-cols-[4.5rem_3rem_1fr_auto] items-center gap-4 border-b border-l-2 border-hairline-soft py-3 pl-3 last:border-b-0', impactStyle(event.impact).border)}
                            >
                              <span className="font-mono text-micro tabular-nums text-ink-subtle">{formatClock(event)}</span>
                              <span className="flex items-center gap-1.5">
                                <span className={clsx('size-1.5 shrink-0 rounded-full', impactStyle(event.impact).dot)} aria-hidden="true" />
                                <span className="font-mono text-[11px] text-ink-subtle">{event.currency}</span>
                              </span>
                              <span className="min-w-0 truncate text-body-sm text-ink">
                                {event.title}
                                <span className="sr-only">, {impactStyle(event.impact).label}</span>
                              </span>
                              <span className="flex items-center gap-3 whitespace-nowrap text-right font-mono text-micro tabular-nums text-ink-muted">
                                {event.previous && <span className="hidden text-ink-subtle sm:inline">ant. {event.previous}</span>}
                                {event.forecast && <span className="hidden text-ink-subtle sm:inline">prev. {event.forecast}</span>}
                                <span className="text-ink">
                                  {event.actual ?? '—'}
                                  <DeltaGlyph event={event} />
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-4 font-mono text-[11px] text-ink-subtle">Fuente: ForexFactory.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
