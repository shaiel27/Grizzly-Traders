'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import type { PriceData } from '@/lib/prices'
import { formatPrice } from '@/lib/format'

interface TickerItem {
  symbol: string
  name: string
  price: number | null
  changePercent: number | null
}

const TICKER_ASSETS: { symbol: string; name: string }[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XAUUSD', name: 'Oro' },
  { symbol: 'EURUSD', name: 'Euro/Dólar' },
  { symbol: 'GBPUSD', name: 'Libra/Dólar' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'NVDA', name: 'Nvidia' },
  { symbol: 'SPX', name: 'S&P 500' },
  { symbol: 'DXY', name: 'Dollar Index' },
]

const REFRESH_MS = 30_000

function applyPrices(items: TickerItem[], prices: PriceData[]): TickerItem[] {
  return items.map((item) => {
    const match = prices.find((price) => price.symbol === item.symbol)
    if (!match || !(match.price > 0)) return item
    return {
      ...item,
      price: match.price,
      changePercent: typeof match.changePercent24h === 'number' ? match.changePercent24h : null,
    }
  })
}

function formatUtcTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function TickerItems({ items, hidden = false }: { items: TickerItem[]; hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-5 pr-5" aria-hidden={hidden || undefined}>
      {items.map((item, index) => {
        const percent = item.changePercent
        const isPositive = (percent ?? 0) >= 0
        return (
          <div key={`${item.symbol}-${index}`} className="flex items-center gap-2.5 whitespace-nowrap">
            <span className="text-[11px] font-bold tracking-wide text-ink">{item.symbol}</span>
            <span className="font-mono tabular-nums text-[11px] font-medium text-on-surface">
              {formatPrice(item.price, item.symbol, { currency: true, forexDecimals: 4 })}
            </span>
            {percent !== null && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-[3px] text-[10px] font-bold tabular-nums',
                  isPositive
                    ? 'bg-semantic-success/15 text-semantic-success'
                    : 'bg-semantic-danger/15 text-semantic-danger'
                )}
              >
                <svg
                  className={clsx('size-[10px] shrink-0', !isPositive && 'rotate-180')}
                  viewBox="0 0 10 10"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M5 2L8.5 7H1.5L5 2Z" />
                </svg>
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

export function LiveTicker({ initialPrices = [] }: { initialPrices?: PriceData[] }) {
  const [tickerData, setTickerData] = useState<TickerItem[]>(() =>
    applyPrices(
      TICKER_ASSETS.map((asset) => ({ ...asset, price: null, changePercent: null })),
      initialPrices
    )
  )
  // Server-provided prices carry their own timestamp, so the label is identical on server and client
  const [updatedAt, setUpdatedAt] = useState<number | null>(() =>
    initialPrices.length > 0 ? Math.max(...initialPrices.map((price) => price.timestamp)) : null
  )
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      if (document.hidden) return
      try {
        const response = await fetch('/api/prices', { signal: controller.signal })
        const result = await response.json()
        if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid prices response')

        setTickerData((prev) => applyPrices(prev, result.data))
        setUpdatedAt(typeof result.timestamp === 'number' ? result.timestamp : Date.now())
        setStale(false)
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch prices:', error)
        setStale(true)
      }
    }

    function schedule(delay: number) {
      timer = setTimeout(async () => {
        await refresh()
        schedule(REFRESH_MS)
      }, delay)
    }

    // The first render already has server prices, so only fetch right away when it doesn't
    schedule(initialPrices.length > 0 ? REFRESH_MS : 0)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialPrices only decides the first delay
  }, [])

  // Each half is longer than any screen, and the two halves are identical, so the -50% loop has no gap or jump
  const half = [...tickerData, ...tickerData]

  return (
    <div className="flex h-8 w-full items-center overflow-hidden border-b border-outline-variant/40 bg-surface-container-lowest">
      <div className="relative z-10 flex h-full shrink-0 items-center gap-2 border-r border-outline-variant/40 bg-surface-container-lowest pl-4 pr-4">
        <span className="relative flex size-1.5" aria-hidden="true">
          {!stale && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-success opacity-75 motion-reduce:animate-none" />
          )}
          <span className={clsx('relative inline-flex size-1.5 rounded-full', stale ? 'bg-semantic-warning' : 'bg-semantic-success')} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink">Mercados</span>
      </div>

      <div className="ticker-viewport relative ml-3 flex w-full items-center" role="marquee" aria-label="Cotizaciones de mercado">
        <div className="ticker-motion items-center">
          <TickerItems items={half} />
          <TickerItems items={half} hidden />
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
    </div>
  )
}
