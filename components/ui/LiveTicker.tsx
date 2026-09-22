'use client'

import { useEffect, useRef, useState, type Ref } from 'react'
import { clsx } from 'clsx'
import type { TickerQuote } from '@/lib/ticker'
import { formatPrice } from '@/lib/format'

interface TickerItem extends TickerQuote {
  // Direction of the last price change; `tick` remounts the price so the flash animation replays
  flash: 'up' | 'down' | null
  tick: number
}

const REFRESH_MS = 3_000
// After failures the interval doubles up to this cap, so an outage isn't hammered every 3 s
const MAX_BACKOFF_MS = 30_000
// Constant reading speed regardless of how many assets are shown
const SCROLL_SPEED_PX_PER_S = 45
// One copy of the loop must be wider than any screen, otherwise the wrap-around shows a gap
const MIN_LOOP_ITEMS = 24

function toItems(quotes: TickerQuote[], previous: TickerItem[] = []): TickerItem[] {
  const before = new Map(previous.map((item) => [item.symbol, item]))
  return quotes.map((quote) => {
    const prev = before.get(quote.symbol)
    if (!prev) return { ...quote, flash: null, tick: 0 }
    if (prev.price === quote.price) return { ...quote, flash: null, tick: prev.tick }
    return { ...quote, flash: quote.price > prev.price ? 'up' : 'down', tick: prev.tick + 1 }
  })
}

function fillLoop(items: TickerItem[]): TickerItem[] {
  if (items.length === 0) return items
  const loop = [...items]
  while (loop.length < MIN_LOOP_ITEMS) loop.push(...items)
  return loop
}

function formatUtcTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  })
}

function TickerItems({
  items,
  hidden = false,
  copyRef,
}: {
  items: TickerItem[]
  hidden?: boolean
  copyRef?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={copyRef} className="flex shrink-0 items-center gap-5 pr-5" aria-hidden={hidden || undefined}>
      {items.map((item, index) => {
        const percent = item.changePercent
        const isPositive = (percent ?? 0) >= 0
        return (
          <div key={`${item.symbol}-${index}`} className="flex items-center gap-2.5 whitespace-nowrap">
            <span className="text-[11px] font-medium text-ink">{item.label}</span>
            <span
              key={item.tick}
              className={clsx(
                'rounded px-1 font-mono tabular-nums text-[11px] text-ink-muted',
                item.flash && `ticker-flash-${item.flash}`
              )}
            >
              {formatPrice(item.price, item.symbol, { currency: item.currency, forexDecimals: 4 })}
            </span>
            {percent !== null && (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  isPositive
                    ? 'bg-semantic-success/10 text-semantic-success'
                    : 'bg-semantic-danger/10 text-semantic-danger'
                )}
              >
                {isPositive ? '+' : ''}
                {percent.toFixed(2)}%
              </span>
            )}
            <span className="px-2 text-[10px] text-outline-variant/40" aria-hidden="true">
              |
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface LiveTickerProps {
  initialQuotes?: TickerQuote[]
  initialUpdatedAt?: number | null
}

export function LiveTicker({ initialQuotes = [], initialUpdatedAt = null }: LiveTickerProps) {
  const [items, setItems] = useState<TickerItem[]>(() => toItems(initialQuotes))
  // Server-provided quotes carry their own timestamp, so the label is identical on server and client
  const [updatedAt, setUpdatedAt] = useState<number | null>(initialUpdatedAt)
  const [stale, setStale] = useState(false)
  const [paused, setPaused] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let failures = 0

    async function refresh() {
      if (document.hidden) return
      try {
        const response = await fetch('/api/ticker', { signal: controller.signal, cache: 'no-store' })
        const result = await response.json()
        if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
          throw new Error('Invalid ticker response')
        }

        setItems((prev) => toItems(result.data, prev))
        setUpdatedAt(typeof result.timestamp === 'number' ? result.timestamp : Date.now())
        setStale(false)
        failures = 0
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch ticker quotes:', error)
        setStale(true)
        failures += 1
      }
    }

    // Requests are spaced from start to start (a true 3 s cadence) but never overlap: the next one is
    // scheduled only after the previous finished, so a slow response just makes the next one immediate
    function schedule(delay: number) {
      timer = setTimeout(async () => {
        const startedAt = Date.now()
        await refresh()
        const interval = Math.min(REFRESH_MS * 2 ** failures, MAX_BACKOFF_MS)
        schedule(Math.max(0, interval - (Date.now() - startedAt)))
      }, delay)
    }

    // Server quotes can be as old as the page cache; fetch right away unless they are fresh enough
    const firstPaintAge = initialUpdatedAt === null ? Infinity : Date.now() - initialUpdatedAt
    schedule(initialQuotes.length > 0 && firstPaintAge < REFRESH_MS ? REFRESH_MS - firstPaintAge : 0)

    // Catch up as soon as the tab is visible again instead of waiting out the interval
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer)
        schedule(0)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the initial props only decide the first delay
  }, [])

  // Loop duration follows the content width so the scroll speed stays the same for any number of assets.
  // Rounded to 5 s so text-width changes from price updates don't retune the animation constantly.
  useEffect(() => {
    const track = trackRef.current
    const copy = copyRef.current
    if (!track || !copy) return

    const applyDuration = () => {
      const width = copy.getBoundingClientRect().width
      if (width <= 0) return
      const seconds = Math.max(30, Math.round(width / SCROLL_SPEED_PX_PER_S / 5) * 5)
      track.style.setProperty('--ticker-duration', `${seconds}s`)
    }

    applyDuration()
    const observer = new ResizeObserver(applyDuration)
    observer.observe(copy)
    return () => observer.disconnect()
  }, [])

  // Two identical copies: translating the track by -50% loops with no gap or jump
  const loop = fillLoop(items)

  return (
    <div className="flex h-8 w-full items-center overflow-hidden border-b border-outline-variant/40 bg-surface-container-lowest">
      <div className="relative z-10 flex h-full shrink-0 items-center gap-2 border-r border-outline-variant/40 bg-surface-container-lowest pl-4 pr-4">
        <span className="relative flex size-1.5" aria-hidden="true">
          {!stale && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-success opacity-75 motion-reduce:animate-none" />
          )}
          <span className={clsx('relative inline-flex size-1.5 rounded-full', stale ? 'bg-semantic-warning' : 'bg-semantic-success')} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Feed en vivo</span>
      </div>

      <div className="ticker-viewport relative ml-3 flex w-full items-center" role="marquee" aria-label="Cotizaciones de mercado">
        <div ref={trackRef} className="ticker-motion items-center" data-paused={paused ? 'true' : undefined}>
          <TickerItems items={loop} copyRef={copyRef} />
          <TickerItems items={loop} hidden />
        </div>
      </div>

      <div className="relative z-10 hidden h-full shrink-0 items-center gap-3 border-l border-outline-variant/40 bg-surface-container-lowest pl-4 pr-4 lg:flex">
        {stale && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-semantic-warning">Datos desactualizados</span>
        )}
        {updatedAt !== null && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
            Actualizado {formatUtcTime(updatedAt)} UTC
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-pressed={paused}
        aria-label={paused ? 'Reanudar desplazamiento de cotizaciones' : 'Pausar desplazamiento de cotizaciones'}
        className="relative z-10 flex h-full w-9 shrink-0 items-center justify-center border-l border-outline-variant/40 bg-surface-container-lowest text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-blue"
      >
        <svg className="size-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          {paused ? <path d="M3 1.5v9l7.5-4.5L3 1.5Z" /> : <path d="M2.5 1.5h2.75v9H2.5v-9Zm4.25 0H9.5v9H6.75v-9Z" />}
        </svg>
      </button>
    </div>
  )
}
