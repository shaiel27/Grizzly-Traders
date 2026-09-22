'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

import { AssetDetailPanel } from '@/components/ui/AssetDetailPanel'
import { AssetTable } from '@/components/ui/AssetTable'
import { CryptoRankings } from '@/components/ui/CryptoRankings'
import { EconomicCalendar } from '@/components/ui/EconomicCalendar'
import { MarketAssetHeader } from '@/components/ui/MarketAssetHeader'
import type { ChartLevel } from '@/components/ui/MarketChart'
import { MarketOverview } from '@/components/ui/MarketOverview'
import { MarketWatchlist, type WatchlistCategory, type WatchlistSort } from '@/components/ui/MarketWatchlist'
import type { MarketCategory } from '@/lib/market-assets'
import type { MarketItem as MarketAsset } from '@/lib/markets'
import type { PivotQuote } from '@/lib/pivot-types'
import { calculatePivots, levelsFor } from '@/lib/pivots'
import { useWatchlist } from '@/lib/watchlist'

// lightweight-charts touches the DOM, so it is loaded on the client only and kept out of the initial bundle
const MarketChart = dynamic(() => import('@/components/ui/MarketChart').then((mod) => mod.MarketChart), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse bg-surface-1" aria-hidden="true" />,
})

const PIVOT_COLOR = { resistance: '#22c55e', pivot: '#0099ff', support: '#ff3b30' } as const
const WIDE_SCREEN = '(min-width: 1280px)'

interface MarketsClientProps {
  initialAssets: MarketAsset[]
  initialSymbol?: string | null
}

export function MarketsClient({ initialAssets, initialSymbol = null }: MarketsClientProps) {
  const [assets, setAssets] = useState<MarketAsset[]>(initialAssets)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol)
  const [loading, setLoading] = useState(initialAssets.length === 0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState(false)
  const [pivotQuotes, setPivotQuotes] = useState<Map<string, PivotQuote>>(new Map())
  const [category, setCategory] = useState<WatchlistCategory>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<WatchlistSort>('default')
  const chartRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLElement>(null)
  const { symbols: favorites, toggle: toggleFavorite } = useWatchlist()

  useEffect(() => {
    async function fetchAssets() {
      if (document.hidden) return
      try {
        const response = await fetch('/api/markets')
        const result = await response.json()
        if (result.success && result.data) {
          setAssets(result.data)
          setLastUpdate(new Date())
          setError(false)
        } else {
          setError(true)
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    // The server already rendered the terminal, so only fetch right away when it came empty
    if (initialAssets.length === 0) fetchAssets()
    const interval = setInterval(fetchAssets, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialAssets only decides the first fetch
  }, [])

  // The previous session's OHLC never changes intraday, so the daily pivots are fetched once
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/pivots?tf=D', { signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (body.success && Array.isArray(body.data)) {
          setPivotQuotes(new Map((body.data as PivotQuote[]).map((quote) => [quote.symbol, quote])))
        }
      })
      .catch(() => {
        // Pivots are an optional layer: without them the chart just has no pivot switch
      })
    return () => controller.abort()
  }, [])

  // Derived, so a refresh never resets the selection and a stale ?activo= falls back to the first asset
  const selectedAsset = assets.find((asset) => asset.symbol === selectedSymbol) ?? assets[0] ?? null

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets.filter((asset) => {
      const inCategory = category === 'all' || (category === 'favorites' ? favorites.includes(asset.symbol) : asset.category === category)
      const matches =
        !term || asset.name.toLowerCase().includes(term) || asset.description.toLowerCase().includes(term) || asset.symbol.toLowerCase().includes(term)
      return inCategory && matches
    })
  }, [assets, category, search, favorites])

  const listAssets = useMemo(() => {
    if (sort === 'change') return [...filtered].sort((a, b) => b.change - a.change)
    if (sort === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    return filtered
  }, [filtered, sort])

  const pivotQuote = selectedAsset ? pivotQuotes.get(selectedAsset.symbol) : undefined
  const pivotLevels = useMemo<ChartLevel[]>(() => {
    if (!pivotQuote) return []
    const { previous } = pivotQuote
    return levelsFor(calculatePivots(previous.high, previous.low, previous.close, previous.open), 'classic').map((level) => ({
      price: level.value,
      title: level.label,
      color: PIVOT_COLOR[level.kind],
    }))
  }, [pivotQuote])

  // Picking from the list on a wide screen needs no scroll (the chart sits beside it); anything else brings the chart into view
  function select(asset: MarketAsset, source: 'list' | 'elsewhere' = 'elsewhere') {
    setSelectedSymbol(asset.symbol)
    // Shareable link to the selected asset, without adding history entries
    window.history.replaceState(null, '', `?activo=${encodeURIComponent(asset.symbol)}`)
    if (source === 'list' && window.matchMedia(WIDE_SCREEN).matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    chartRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  // From the overview: show that category in the list and bring the list into view
  function showCategory(next: MarketCategory) {
    setCategory(next)
    setSearch('')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    terminalRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  const filtersActive = category !== 'all' || search.trim() !== ''
  function clearFilters() {
    setCategory('all')
    setSearch('')
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[104px] pb-24">
      <div className="mx-auto max-w-[1400px] px-6 pt-8 md:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-ink">Terminal de mercados</h1>
            <p className="mt-1 text-[14px] text-ink-muted">{assets.length} activos de cripto, forex, materias primas, índices y acciones.</p>
          </div>
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="relative flex size-1.5" aria-hidden="true">
              {!error && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-success opacity-70" />}
              <span className={error ? 'relative inline-flex size-1.5 rounded-full bg-semantic-warning' : 'relative inline-flex size-1.5 rounded-full bg-semantic-success'} />
            </span>
            {lastUpdate ? `Actualizado a las ${lastUpdate.toLocaleTimeString('es-ES')}` : 'Datos en vivo'}
          </p>
        </header>

        {error && (
          <p role="alert" className="mb-6 rounded-[8px] border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-[13px] text-ink">
            No se pudieron actualizar los datos de mercado. Se reintentará en un minuto.
          </p>
        )}

        <section ref={terminalRef} aria-label="Terminal" className="scroll-mt-[124px] flex flex-col gap-4 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6">
          <div className="relative order-2 overflow-hidden rounded-[10px] border border-hairline bg-surface-container-lowest xl:order-1">
            <div className="flex max-h-[460px] min-h-0 flex-col xl:absolute xl:inset-0 xl:max-h-none">
              <MarketWatchlist
                assets={listAssets}
                selectedSymbol={selectedAsset?.symbol ?? null}
                favorites={favorites}
                category={category}
                search={search}
                sort={sort}
                onCategoryChange={setCategory}
                onSearchChange={setSearch}
                onSortChange={setSort}
                onSelect={(asset) => select(asset, 'list')}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          </div>

          <div ref={chartRef} className="order-1 min-w-0 scroll-mt-[124px] overflow-hidden rounded-[10px] border border-hairline bg-surface-container-lowest xl:order-2">
            {selectedAsset ? (
              <>
                <MarketAssetHeader asset={selectedAsset} isFavorite={favorites.includes(selectedAsset.symbol)} onToggleFavorite={() => toggleFavorite(selectedAsset.symbol)} />
                <div className="mt-5 border-y border-hairline">
                  <MarketChart
                    key={selectedAsset.symbol}
                    bare
                    symbol={selectedAsset.symbol}
                    name={selectedAsset.name}
                    height={440}
                    levels={pivotLevels}
                    levelsLabel="Pivotes diarios"
                    initialTimeframe={pivotLevels.length > 0 ? '1h' : '1d'}
                  />
                </div>
                <AssetDetailPanel key={selectedAsset.symbol} asset={selectedAsset} />
              </>
            ) : (
              <div className="h-[720px] animate-pulse bg-surface-1" aria-hidden="true" />
            )}
          </div>
        </section>

        <section className="mt-20" aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="text-[22px] font-semibold tracking-tight text-ink">
            Panorama del mercado
          </h2>
          <p className="mb-10 mt-1 max-w-2xl text-[14px] text-ink-muted">Una lectura rápida de cómo va hoy el mercado.</p>
          <MarketOverview assets={assets} onSelect={(asset) => select(asset)} onSelectCategory={showCategory} />
        </section>

        <section className="mt-20">
          <CryptoRankings />
        </section>

        <section className="mt-20">
          <EconomicCalendar />
        </section>

        <section className="mt-20" aria-labelledby="screener-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 id="screener-heading" className="text-[22px] font-semibold tracking-tight text-ink">
                Análisis técnico
              </h2>
              <p className="mt-1 max-w-2xl text-[14px] text-ink-muted">
                Ordena por RSI, ADX, señal o rentabilidad para encontrar activos. Sigue la categoría y la búsqueda de la lista.
              </p>
            </div>
            <p className="text-[13px] text-ink-muted">
              {filtered.length} de {assets.length} activos
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="ml-3 text-accent-blue hover:text-accent-blue-hover">
                  Quitar filtros
                </button>
              )}
            </p>
          </div>
          <AssetTable
            assets={filtered}
            loading={loading}
            selectedSymbol={selectedAsset?.symbol ?? null}
            onSelectAsset={(asset) => select(asset)}
            resetKey={`${category}|${search}`}
            emptyMessage={category === 'favorites' ? 'Todavía no tienes favoritos.' : 'Ningún activo coincide con los filtros.'}
          />
        </section>
      </div>
    </main>
  )
}
