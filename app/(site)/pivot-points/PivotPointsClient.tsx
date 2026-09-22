'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { PivotAssetList, type PivotRow } from '@/components/ui/PivotAssetList'
import { PageControls } from '@/components/ui/PageControls'
import { PivotAssetPanel } from '@/components/ui/PivotAssetPanel'
import { PivotCalculator } from '@/components/ui/PivotCalculator'
import { pageCount, pageSlice } from '@/lib/pagination'
import { PIVOT_ASSETS, PIVOT_ASSET_BY_TV, PIVOT_CATEGORIES, type PivotCategory } from '@/lib/pivot-assets'
import { PIVOT_METHOD_INFO } from '@/lib/pivot-methods'
import { PIVOT_TIMEFRAMES, type PivotQuote, type PivotTimeframe } from '@/lib/pivot-types'
import { PIVOT_METHODS, analyzePosition, calculatePivots, distancePct, levelsFor, type PivotMethod } from '@/lib/pivots'
import { useWatchlist } from '@/lib/watchlist'

const REFRESH_MS = 15_000
// Assets shown per page in the list
const PAGE_SIZE = 10

type CategoryFilter = 'all' | PivotCategory
type SortKey = 'default' | 'change' | 'proximity'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Predeterminado' },
  { key: 'change', label: 'Mayor variación hoy' },
  { key: 'proximity', label: 'Más cerca de un nivel' },
]

function formatUtcTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })
}

// Smallest distance (in %) from the price to the level directly above or below it
function nearestDistance(row: PivotRow): number {
  const distances = [row.position.resistance, row.position.support]
    .filter((level) => level !== null)
    .map((level) => Math.abs(distancePct(level.value, row.quote.price)))
  return distances.length ? Math.min(...distances) : Infinity
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { key: T; label: string; title?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          title={option.title}
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={clsx(
            'whitespace-nowrap rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider transition-all',
            value === option.key ? 'bg-surface-container-lowest text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface PivotPointsClientProps {
  initialQuotes: PivotQuote[]
}

export function PivotPointsClient({ initialQuotes }: PivotPointsClientProps) {
  const [timeframe, setTimeframe] = useState<PivotTimeframe>('D')
  const [quotes, setQuotes] = useState<PivotQuote[]>(initialQuotes)
  // The timeframe the quotes belong to: while it differs from the selected one, we are loading
  const [quotesTimeframe, setQuotesTimeframe] = useState<PivotTimeframe | null>(initialQuotes.length > 0 ? 'D' : null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [method, setMethod] = useState<PivotMethod>('classic')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [sort, setSort] = useState<SortKey>('default')
  const [selectedTv, setSelectedTv] = useState<string | null>(null)

  const { symbols: favorites, toggle: toggleFavorite } = useWatchlist()
  const seeded = useRef(initialQuotes.length > 0)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      try {
        const response = await fetch(`/api/pivots?tf=${timeframe}`, { signal: controller.signal, cache: 'no-store' })
        const result = await response.json()
        if (!result.success || !Array.isArray(result.data)) throw new Error('Invalid pivots response')

        setQuotes(result.data)
        setQuotesTimeframe(timeframe)
        setUpdatedAt(Date.now())
        setError(false)
      } catch (failure) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch pivots:', failure)
        setError(true)
      }
    }

    function schedule(delay: number) {
      timer = setTimeout(async () => {
        if (!document.hidden) await refresh()
        schedule(REFRESH_MS)
      }, delay)
    }

    // The server already rendered the daily quotes; any other timeframe (or an empty first paint) fetches now
    const skipFirstFetch = seeded.current && timeframe === 'D'
    seeded.current = false
    if (skipFirstFetch) schedule(REFRESH_MS)
    else refresh().then(() => !controller.signal.aborted && schedule(REFRESH_MS))

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [timeframe, reloadKey])

  const loading = quotesTimeframe !== timeframe
  const timeframeInfo = PIVOT_TIMEFRAMES.find((option) => option.key === timeframe)!

  const rows = useMemo<PivotRow[]>(() => {
    if (loading) return []
    return quotes.flatMap((quote) => {
      const asset = PIVOT_ASSET_BY_TV.get(quote.symbol)
      if (!asset) return []
      const { previous } = quote
      const levels = levelsFor(calculatePivots(previous.high, previous.low, previous.close, previous.open), method)
      return [{ asset, quote, levels, position: analyzePosition(levels, quote.price) }]
    })
  }, [quotes, method, loading])

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = rows.filter(
      ({ asset }) =>
        (category === 'all' || asset.category === category) &&
        (!onlyFavorites || favorites.includes(asset.tv)) &&
        (!term || asset.label.toLowerCase().includes(term) || asset.name.toLowerCase().includes(term))
    )
    if (sort === 'change') return [...filtered].sort((a, b) => Math.abs(b.quote.change) - Math.abs(a.quote.change))
    if (sort === 'proximity') return [...filtered].sort((a, b) => nearestDistance(a) - nearestDistance(b))
    return filtered
  }, [rows, category, onlyFavorites, favorites, search, sort])

  const [page, setPage] = useState(0)
  const resetKey = `${timeframe}|${category}|${onlyFavorites}|${sort}|${search}`
  const [seenResetKey, setSeenResetKey] = useState(resetKey)
  // Any change to what the list shows sends it back to page 1 (reset while rendering: no frame with a stale page)
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey)
    setPage(0)
  }
  const currentPage = Math.min(page, pageCount(visibleRows.length, PAGE_SIZE) - 1)
  const pageRows = pageSlice(visibleRows, currentPage, PAGE_SIZE)

  const selectedRow = rows.find((row) => row.asset.tv === selectedTv) ?? visibleRows[0] ?? rows[0] ?? null
  const filtersActive = category !== 'all' || onlyFavorites || search.trim() !== ''
  // Some futures have no weekly or monthly bars in the data source
  const missingAssets = loading || rows.length === 0 ? [] : PIVOT_ASSETS.filter((asset) => !rows.some((row) => row.asset.tv === asset.tv))

  function clearFilters() {
    setCategory('all')
    setOnlyFavorites(false)
    setSearch('')
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[104px] pb-24">
      <div className="section-container mx-auto max-w-[1400px] pt-8">
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[28px] text-accent-blue" aria-hidden="true">
              candlestick_chart
            </span>
            <h1 className="text-display-lg-mobile font-bold text-ink sm:text-display-lg">Pivot Points</h1>
          </div>
          <p className="max-w-3xl text-body text-on-surface-variant">
            Soportes y resistencias calculados con el máximo, mínimo y cierre de la {timeframeInfo.period}, con cinco métodos distintos. Los
            precios se actualizan solos cada 15 segundos.
          </p>
          <p className="mt-2 flex items-center gap-2 text-micro text-ink-subtle">
            <span className="relative flex size-1.5" aria-hidden="true">
              {!error && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-success opacity-75" />}
              <span className={clsx('relative inline-flex size-1.5 rounded-full', error ? 'bg-semantic-warning' : 'bg-semantic-success')} />
            </span>
            {updatedAt ? `Actualizado ${formatUtcTime(updatedAt)} UTC` : initialQuotes.length > 0 ? 'Datos cargados' : 'Cargando datos…'} · Fuente: TradingView
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-body-sm text-ink">
            <span>{quotes.length > 0 && !loading ? 'No se pudieron actualizar los pivotes; se muestran los últimos datos.' : 'No se pudieron cargar los pivotes.'}</span>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="rounded-lg border border-semantic-warning/50 px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-semantic-warning/20"
            >
              Reintentar
            </button>
          </div>
        )}

        <div className="mb-6 space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex max-w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-micro font-bold uppercase tracking-wider text-ink-muted">Período</span>
              <Segmented
                label="Período"
                value={timeframe}
                onChange={setTimeframe}
                options={PIVOT_TIMEFRAMES.map((option) => ({ key: option.key, label: option.label, title: `Usa la ${option.period}` }))}
              />
            </div>
            <div className="flex min-w-0 max-w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="text-micro font-bold uppercase tracking-wider text-ink-muted">Método</span>
              <Segmented
                label="Método"
                value={method}
                onChange={setMethod}
                options={PIVOT_METHODS.map((option) => ({ key: option, label: PIVOT_METHOD_INFO[option].short, title: PIVOT_METHOD_INFO[option].levels }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-hairline-soft pt-4">
            <div role="group" aria-label="Categorías" className="flex flex-wrap gap-2">
              {([{ key: 'all', label: 'Todos' }, ...PIVOT_CATEGORIES] as { key: CategoryFilter; label: string }[]).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={category === option.key}
                  onClick={() => setCategory(option.key)}
                  className={clsx(
                    'rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all',
                    category === option.key
                      ? 'border-accent-blue bg-accent-blue text-white'
                      : 'border-outline-variant/40 text-ink-muted hover:border-outline-variant hover:text-ink'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-pressed={onlyFavorites}
                onClick={() => setOnlyFavorites((value) => !value)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all',
                  onlyFavorites
                    ? 'border-semantic-warning/60 bg-semantic-warning/10 text-semantic-warning'
                    : 'border-outline-variant/40 text-ink-muted hover:border-outline-variant hover:text-ink'
                )}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  star
                </span>
                Favoritos
              </button>

              <label className="sr-only" htmlFor="pivot-sort">
                Ordenar por
              </label>
              <select
                id="pivot-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="rounded-full border border-outline-variant/40 bg-surface-2 px-3.5 py-1.5 text-[11px] font-bold text-ink-muted focus:border-accent-blue focus:outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

            </div>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest" aria-label="Niveles por activo">
            <div className="flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-low px-6 py-4">
              <h2 className="text-subhead font-bold text-ink">Niveles por activo</h2>
              <p className="text-micro text-ink-muted">
                {loading ? 'Cargando…' : `${visibleRows.length} de ${rows.length} activos`}
              </p>
            </div>

            <div className="border-b border-outline-variant/40 px-6 py-3">
              <label className="sr-only" htmlFor="pivot-search">
                Buscar activo
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-ink-subtle" aria-hidden="true">
                  search
                </span>
                <input
                  id="pivot-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre o símbolo"
                  autoComplete="off"
                  className="w-full rounded-full border border-outline-variant/40 bg-surface-2 py-2 pl-10 pr-4 text-body-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:outline-none"
                />
              </div>
            </div>

            {missingAssets.length > 0 && (
              <p className="border-b border-hairline-soft px-6 py-2 text-micro text-ink-subtle">
                Sin datos de la {timeframeInfo.period}: {missingAssets.map((asset) => asset.label).join(', ')}.
              </p>
            )}

            {!loading && rows.length > 0 && visibleRows.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="mb-1 text-body text-ink-muted">Ningún activo coincide con los filtros.</p>
                {filtersActive && (
                  <button type="button" onClick={clearFilters} className="mt-2 text-body-sm font-medium text-accent-blue hover:text-accent-blue-hover">
                    Quitar filtros
                  </button>
                )}
              </div>
            ) : !loading && rows.length === 0 ? (
              <p className="px-6 py-14 text-center text-body text-ink-muted">No hay datos de pivotes disponibles por ahora.</p>
            ) : (
              <PivotAssetList
                rows={pageRows}
                selected={selectedRow?.asset.tv ?? null}
                favorites={favorites}
                loading={loading}
                onSelect={setSelectedTv}
                onToggleFavorite={toggleFavorite}
              />
            )}

            {!loading && (
              <PageControls
                page={currentPage}
                total={visibleRows.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                label="Paginación de niveles por activo"
                className="border-t border-outline-variant/40 px-6 py-3"
              />
            )}
          </section>

          <div className="lg:sticky lg:top-[128px] lg:self-start">
            {selectedRow ? (
              <PivotAssetPanel
                asset={selectedRow.asset}
                quote={selectedRow.quote}
                method={method}
                timeframe={timeframe}
                periodLabel={timeframeInfo.period}
              />
            ) : (
              <div className="h-[560px] animate-pulse rounded-2xl bg-surface-2" aria-hidden="true" />
            )}
          </div>
        </div>

        <section className="mb-10" aria-label="Calculadora de pivot points">
          <PivotCalculator
            quotes={loading ? [] : quotes}
            timeframeLabel={timeframeInfo.label}
            periodLabel={timeframeInfo.period}
            selectedAsset={selectedRow?.asset.tv ?? null}
          />
        </section>

        <section aria-labelledby="pivot-methods-heading">
          <h2 id="pivot-methods-heading" className="mb-4 text-subhead font-bold text-ink">
            Cómo se calculan
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PIVOT_METHODS.map((option) => {
              const info = PIVOT_METHOD_INFO[option]
              return (
                <article key={option} className={clsx('rounded-2xl border bg-surface-container-lowest p-5', option === method ? 'border-accent-blue/50' : 'border-outline-variant/40')}>
                  <h3 className="mb-2 flex items-center gap-2 text-body-sm font-bold text-ink">
                    <span className="material-symbols-outlined text-[18px] text-accent-blue" aria-hidden="true">
                      {info.icon}
                    </span>
                    {info.label}
                  </h3>
                  <p className="mb-3 text-body-sm text-ink-muted">{info.description}</p>
                  <p className="font-mono text-[11px] leading-relaxed text-ink-subtle">{info.formula}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-ink-subtle">{info.levels}</p>
                </article>
              )
            })}
          </div>
          <p className="mt-6 max-w-3xl text-micro leading-relaxed text-ink-subtle">
            Los pivotes son una referencia técnica, no una recomendación de compra o venta: el precio puede ignorarlos. Los datos provienen de un
            servicio no oficial de TradingView y pueden tener retraso o interrupciones.
          </p>
        </section>
      </div>
    </main>
  )
}
