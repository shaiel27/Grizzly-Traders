'use client'

import { AdSlot } from '@/components/ads/AdSlot'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { descripcionDe } from '@/lib/calendar-descriptions'
import { isWeekend, localDayKey, nextRelease, visibleEvents } from '@/lib/calendar-events'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { t, type Dictionary, type Locale } from '@/lib/i18n/get-dictionary'

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

const IMPACT_STYLES: Record<string, { dot: string; border: string; labelKey: keyof Dictionary['calendar'] }> = {
  high: { dot: 'bg-semantic-danger', border: 'border-l-semantic-danger', labelKey: 'impactHigh' },
  medium: { dot: 'bg-semantic-warning', border: 'border-l-semantic-warning', labelKey: 'impactMedium' },
  low: { dot: 'bg-ink-subtle', border: 'border-l-transparent', labelKey: 'impactLow' },
  holiday: { dot: 'bg-ink-subtle', border: 'border-l-transparent', labelKey: 'holiday' },
}

const LEGEND: { key: string; dot: string; border: string; color: keyof Dictionary['calendar']; label: keyof Dictionary['calendar']; text: keyof Dictionary['calendar'] }[] = [
  { key: 'high', dot: 'bg-semantic-danger', border: 'border-l-semantic-danger', color: 'colorRed', label: 'impactHigh', text: 'legendHigh' },
  { key: 'medium', dot: 'bg-semantic-warning', border: 'border-l-semantic-warning', color: 'colorYellow', label: 'impactMedium', text: 'legendMedium' },
  { key: 'low', dot: 'bg-ink-subtle', border: 'border-l-transparent', color: 'colorGray', label: 'impactLow', text: 'legendLow' },
  { key: 'holiday', dot: 'bg-ink-subtle', border: 'border-l-transparent', color: 'colorGray', label: 'holiday', text: 'legendHoliday' },
]

const CURRENCIES =['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD']

function impactStyle(impact: string) {
  return IMPACT_STYLES[impact] ?? IMPACT_STYLES.low
}

function impactLabel(impact: string, dict: Dictionary): string {
  return dict.calendar[impactStyle(impact).labelKey]
}

function eventDate(event: ForexEvent): Date | null {
  if (event.event_timestamp) {
    const d = new Date(event.event_timestamp)
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function localeTag(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'es-ES'
}

function formatClock(event: ForexEvent, locale: Locale, dict: Dictionary): string {
  if (event.is_all_day) return dict.calendar.allDay
  const date = eventDate(event)
  if (!date) return event.event_time ?? '—'
  return date.toLocaleTimeString(localeTag(locale), { hour: '2-digit', minute: '2-digit' })
}

// Día LOCAL del visitante (no la fecha en ET de la fila): ver lib/calendar-events.ts
function dayKey(event: ForexEvent): string {
  return localDayKey(event)
}

function formatDayLabel(dateStr: string, locale: Locale, dict: Dictionary): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return dict.calendar.today
  if (diffDays === 1) return dict.calendar.tomorrow
  return date.toLocaleDateString(localeTag(locale), { weekday: 'long', day: 'numeric', month: 'short' })
}

// Evento de hoy que ya ocurrió: se conserva en la lista pero atenuado
function isPast(event: ForexEvent, now: Date | null): boolean {
  const date = eventDate(event)
  return !!now && !!date && date.getTime() < now.getTime()
}

function formatCountdown(target: Date, now: Date, dict: Dictionary): string {
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return dict.calendar.inProgress
  const totalMinutes = Math.round(diffMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return t(dict.calendar.inMinutes, { n: minutes })
  if (hours < 24) return minutes > 0 ? t(dict.calendar.inHoursMinutes, { h: hours, n: minutes }) : t(dict.calendar.inHours, { n: hours })
  const days = Math.floor(hours / 24)
  const unit = days === 1 ? dict.calendar.dayUnitSingular : dict.calendar.dayUnitPlural
  return t(dict.calendar.inDays, { n: days, unit })
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

export function ForexCalendar({ headingLevel = 'h2', anuncio = false }: { headingLevel?: 'h1' | 'h2'; anuncio?: boolean }) {
  const Heading = headingLevel
  const { locale, dictionary: dict } = useLocale()
  const [events, setEvents] = useState<ForexEvent[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [activeCurrency, setActiveCurrency] = useState<string | null>(null)
  const [now, setNow] = useState<Date | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  // Sin `now` (SSR/primer render) no se sabe qué día es hoy: la lista espera al primer tick.
  // visibleEvents quita los días ya pasados y el ruido de fin de semana (ver lib/calendar-events.ts).
  const visible = useMemo(() => (events && now ? visibleEvents(events, now) : []), [events, now])

  const availableCurrencies = useMemo(() => {
    const set = new Set(visible.map((event) => event.currency))
    return CURRENCIES.filter((code) => set.has(code))
  }, [visible])

  const filtered = useMemo(() => {
    return activeCurrency ? visible.filter((event) => event.currency === activeCurrency) : visible
  }, [visible, activeCurrency])

  const nextEvent = useMemo(() => {
    if (!now) return null
    return nextRelease(filtered, now)
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
          {events !== null && now !== null && !failed && <span className="tabular-nums">{t(dict.calendar.eventsCount, { n: filtered.length })}</span>}
        </div>

        <div className="px-5 py-6 md:px-8 md:py-8">
          <Heading id="forex-calendar-heading" className="font-serif text-headline text-ink">
            {dict.calendar.pageTitle}
          </Heading>
          <p className="mb-5 mt-1.5 max-w-2xl text-body-sm text-ink-muted">
            {dict.calendar.description}
          </p>

          {!failed && (
            <div className="mb-8 rounded-xl border border-hairline bg-surface-1 px-4 py-3">
              <p className="mb-2 font-mono text-micro uppercase tracking-wider text-ink-subtle">{dict.calendar.legendTitle}</p>
              <ul className="grid gap-x-6 gap-y-2 text-body-sm sm:grid-cols-2">
                {LEGEND.map(({ key, dot, border, color, label, text }) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <span className={clsx('mt-1 flex h-4 items-center border-l-2 pl-2', border)} aria-hidden="true">
                      <span className={clsx('size-2 rounded-full', dot)} />
                    </span>
                    <span>
                      <span className="font-medium text-ink">{dict.calendar[color]} · {dict.calendar[label]}</span>
                      <span className="text-ink-muted"> — {dict.calendar[text]}</span>
                    </span>
                  </li>
                ))}
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-6 text-center text-[10px] text-accent-blue" aria-hidden="true">▲▼</span>
                  <span>
                    <span className="font-medium text-ink">{dict.calendar.legendDeltaTitle}</span>
                    <span className="text-ink-muted"> — {dict.calendar.legendDeltaText}</span>
                  </span>
                </li>
              </ul>
            </div>
          )}

          {/* Pantallas donde no caben las columnas laterales (/calendario): un anuncio dentro de la página */}
          {anuncio && !failed && (
            <div className="mb-8 flex justify-center min-[1340px]:hidden">
              <AdSlot nombre="articulo" className="w-[302px] max-w-full" />
            </div>
          )}

          {failed && <p className="text-body-sm text-ink-muted">{dict.calendar.errorMessage}</p>}

          {!failed && (events?.length === 0 || (events !== null && now !== null && visible.length === 0)) && (
            <p className="text-body-sm text-ink-muted">{now && isWeekend(now) ? dict.calendar.weekendMessage : dict.calendar.emptyMessage}</p>
          )}

          {!failed && events?.length !== 0 && !(events !== null && now !== null && visible.length === 0) && (
            <>
              {events === null || now === null ? (
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
                  <span className="sr-only">{dict.calendar.loadingLabel}</span>
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
                          {dict.calendar.nextEvent}
                          <span aria-hidden="true">·</span>
                          <span className="rounded-xs bg-surface-2 px-1.5 py-0.5 font-medium text-ink">{nextEvent.currency}</span>
                          <span>{impactLabel(nextEvent.impact, dict)}</span>
                        </div>
                        <p className="mt-1.5 truncate text-body font-medium text-ink">{nextEvent.title}</p>
                        {descripcionDe(nextEvent.title) && (
                          <p className="mt-1 line-clamp-2 text-body-sm text-ink-muted">{descripcionDe(nextEvent.title)?.[locale === 'en' ? 'en' : 'es'].que}</p>
                        )}
                        {(nextEvent.forecast || nextEvent.previous) && (
                          <p className="mt-1 font-mono text-micro text-ink-muted">
                            {nextEvent.previous && <>{dict.calendar.previous} {nextEvent.previous}</>}
                            {nextEvent.previous && nextEvent.forecast && <span className="mx-1.5 text-ink-subtle">→</span>}
                            {nextEvent.forecast && <>{dict.calendar.forecast} {nextEvent.forecast}</>}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-mono text-[20px] font-semibold tabular-nums text-accent-blue">
                          {(() => {
                            const date = eventDate(nextEvent)
                            return date ? formatCountdown(date, now, dict) : ''
                          })()}
                        </p>
                        <p className="font-mono text-micro tabular-nums text-ink-subtle">{formatClock(nextEvent, locale, dict)}</p>
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
                        {dict.calendar.allCurrencies}
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
                          {formatDayLabel(day, locale, dict)}
                        </h2>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <caption className="sr-only">{formatDayLabel(day, locale, dict)}</caption>
                            <thead>
                              <tr className="border-b border-hairline font-mono text-micro uppercase tracking-wider text-ink-subtle">
                                <th scope="col" className="py-2 pl-3 pr-1 font-medium sm:w-20 sm:pr-2">{dict.calendar.colTime}</th>
                                <th scope="col" className="px-1 py-2 font-medium sm:w-24 sm:px-2">{dict.calendar.colCurrency}</th>
                                <th scope="col" className="px-2 py-2 font-medium">{dict.calendar.colEvent}</th>
                                <th scope="col" className="hidden w-20 px-2 py-2 text-right font-medium sm:table-cell">{dict.calendar.colPrevious}</th>
                                <th scope="col" className="hidden w-20 px-2 py-2 text-right font-medium sm:table-cell">{dict.calendar.colForecast}</th>
                                <th scope="col" className="px-2 py-2 text-right font-medium">{dict.calendar.colActual}</th>
                                <th scope="col" className="w-14 py-2 pl-2 pr-3 text-right font-medium">{dict.calendar.colInfo}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayEvents.map((event) => {
                                const familia = descripcionDe(event.title)
                                const abierto = expandedId === event.id
                                const idioma = locale === 'en' ? 'en' : 'es'
                                const alternar = () => setExpandedId(abierto ? null : event.id)
                                return (
                                  <Fragment key={event.id}>
                                    <tr
                                      onClick={familia ? alternar : undefined}
                                      className={clsx(
                                        'border-b border-hairline-soft',
                                        familia && 'cursor-pointer transition-colors hover:bg-surface-1',
                                        isPast(event, now) && !abierto && 'text-ink-muted'
                                      )}
                                    >
                                      <td className={clsx('border-l-2 py-3 pl-3 pr-1 align-top font-mono sm:pr-2 text-micro tabular-nums text-ink-subtle', impactStyle(event.impact).border)}>
                                        {formatClock(event, locale, dict)}
                                      </td>
                                      <td className="px-1 py-3 align-top sm:px-2">
                                        <span className="flex items-center gap-1.5">
                                          <span className={clsx('size-1.5 shrink-0 rounded-full', impactStyle(event.impact).dot)} aria-hidden="true" />
                                          <span className="font-mono text-[11px] text-ink">{event.currency}</span>
                                        </span>
                                      </td>
                                      <td className="px-2 py-3 align-top text-body-sm text-ink">
                                        {event.title}
                                        <span className="sr-only">, {impactLabel(event.impact, dict)}</span>
                                      </td>
                                      <td className="hidden px-2 py-3 text-right align-top font-mono text-micro tabular-nums text-ink-subtle sm:table-cell">{event.previous ?? '—'}</td>
                                      <td className="hidden px-2 py-3 text-right align-top font-mono text-micro tabular-nums text-ink-subtle sm:table-cell">{event.forecast ?? '—'}</td>
                                      <td className="px-2 py-3 text-right align-top font-mono text-micro tabular-nums text-ink">
                                        {event.actual ?? '—'}
                                        <DeltaGlyph event={event} />
                                      </td>
                                      <td className="py-2 pl-2 pr-3 text-right align-top">
                                        {familia ? (
                                          <button
                                            type="button"
                                            aria-expanded={abierto}
                                            aria-controls={abierto ? `evento-${event.id}` : undefined}
                                            aria-label={t(dict.calendar.detailsAria, { title: event.title })}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              alternar()
                                            }}
                                            className="inline-flex size-7 items-center justify-center rounded text-ink-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
                                          >
                                            <span className={clsx('material-symbols-outlined text-[18px] transition-transform duration-150', abierto && 'rotate-180')} aria-hidden="true">
                                              expand_more
                                            </span>
                                          </button>
                                        ) : (
                                          <span className="text-ink-subtle" aria-hidden="true">—</span>
                                        )}
                                      </td>
                                    </tr>
                                    {familia && abierto && (
                                      <tr id={`evento-${event.id}`} className="border-b border-hairline-soft bg-surface-1">
                                        <td colSpan={7} className="space-y-3 px-4 py-4 text-body-sm">
                                          <p>
                                            <span className="block font-mono text-micro uppercase tracking-wider text-ink-subtle">{dict.calendar.whatLabel}</span>
                                            <span className="text-ink">{familia[idioma].que}</span>
                                          </p>
                                          <p>
                                            <span className="block font-mono text-micro uppercase tracking-wider text-ink-subtle">{dict.calendar.whyLabel}</span>
                                            <span className="text-ink-muted">{familia[idioma].porque}</span>
                                          </p>
                                          {(event.previous || event.forecast) && (
                                            <p className="font-mono text-micro text-ink-muted sm:hidden">
                                              {event.previous && <>{dict.calendar.previous} {event.previous}</>}
                                              {event.previous && event.forecast && <span className="mx-1.5 text-ink-subtle">→</span>}
                                              {event.forecast && <>{dict.calendar.forecast} {event.forecast}</>}
                                            </p>
                                          )}
                                          {familia.fuentes?.[event.currency] && (
                                            <p className="text-caption">
                                              <a
                                                href={familia.fuentes[event.currency]?.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-accent-blue hover:underline"
                                              >
                                                {t(dict.calendar.sourceLabel, { name: familia.fuentes[event.currency]?.nombre ?? '' })}
                                              </a>
                                            </p>
                                          )}
                                          <p className="text-[12px] text-ink-subtle">{dict.calendar.detailsDisclaimer}</p>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-4 font-mono text-[11px] text-ink-subtle">{dict.calendar.source}</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
