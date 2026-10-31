'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

import { AssetDetailPanel } from '@/components/ui/AssetDetailPanel'
import { AssetTable } from '@/components/ui/AssetTable'
import { CryptoRankings } from '@/components/ui/CryptoRankings'
import { MarketAssetHeader } from '@/components/ui/MarketAssetHeader'
import type { ChartLevel } from '@/components/ui/MarketChart'
import { MarketOverview } from '@/components/ui/MarketOverview'
import { MarketWatchlist, SEARCH_INPUT_ID, type WatchlistCategory, type WatchlistSort } from '@/components/ui/MarketWatchlist'
import { PriceAlerts } from '@/components/ui/PriceAlerts'
import type { TimeframeKey } from '@/lib/candles'
import { formatDataAge } from '@/lib/format'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import type { MarketCategory } from '@/lib/market-assets'
import { compareByChange, compareByName } from '@/lib/market-sort'
import type { MarketItem as MarketAsset } from '@/lib/markets'
import { PIVOT_ASSET_BY_TV } from '@/lib/pivot-assets'
import type { PivotQuote } from '@/lib/pivot-types'
import { calculatePivots, levelsFor } from '@/lib/pivots'
import { useWatchlist } from '@/lib/watchlist'

// next/dynamic still renders `loading` as a regular component, so it can use hooks like any other
function ChartLoading() {
  const dict = useDictionary().markets
  return (
    <div className="h-[520px] animate-pulse motion-reduce:animate-none bg-surface-1" role="status" aria-live="polite">
      <span className="sr-only">{dict.chartLoading}</span>
    </div>
  )
}

// lightweight-charts touches the DOM, so it is loaded on the client only and kept out of the initial bundle
const MarketChart = dynamic(() => import('@/components/ui/MarketChart').then((mod) => mod.MarketChart), {
  ssr: false,
  loading: ChartLoading,
})

const PIVOT_COLOR = { resistance: '#22c55e', pivot: '#0099ff', support: '#ff3b30' } as const
const WIDE_SCREEN = '(min-width: 1280px)'
// Cadencia de la edad relativa del badge: la más barata que sigue leyéndose viva (el dato se
// refresca cada 30 s) sin re-pintar el terminal cada segundo
const DATA_AGE_TICK_MS = 5_000

interface MarketsClientProps {
  initialAssets: MarketAsset[]
  initialSymbol?: string | null
}

export function MarketsClient({ initialAssets, initialSymbol = null }: MarketsClientProps) {
  const { locale } = useLocale()
  const { markets: dict, priceAlerts: alertsDict } = useDictionary()
  const [assets, setAssets] = useState<MarketAsset[]>(initialAssets)
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol)
  const [loading, setLoading] = useState(initialAssets.length === 0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  // El intervalo de más abajo solo mueve este tick; la edad del badge se deriva de él en el render
  const [dataAgeTick, setDataAgeTick] = useState(() => Date.now())
  const [error, setError] = useState(false)
  // Cambiar este valor relanza el sondeo al instante: es el motor del botón Reintentar
  const [reloadKey, setReloadKey] = useState(0)
  // El terminal es dueño del sondeo de la cotización en vivo del activo seleccionado
  const [liveQuote, setLiveQuote] = useState<{ symbol: string; close: number; change: number; changeAbs: number } | null>(null)
  // Derived, so a refresh never resets the selection: a symbol the catalog doesn't have (a stale
  // ?activo=, a delisting) simply isn't shown — the list and the chart keep the first asset and the
  // URL is rewritten below to match what is actually on screen
  const selectedAsset = assets.find((asset) => asset.symbol === selectedSymbol) ?? assets[0] ?? null
  const activeSymbol = selectedAsset?.symbol ?? null
  // Al cambiar de activo la cotización previa se descarta en el render, antes de que el header pueda pintarla
  const [quoteSymbol, setQuoteSymbol] = useState<string | null>(activeSymbol)
  if (quoteSymbol !== activeSymbol) {
    setQuoteSymbol(activeSymbol)
    setLiveQuote(null)
  }
  const [pivotQuotes, setPivotQuotes] = useState<Map<string, PivotQuote>>(new Map())
  const [category, setCategory] = useState<WatchlistCategory>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<WatchlistSort>('default')
  const chartRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLElement>(null)
  const { symbols: favorites, toggle: toggleFavorite } = useWatchlist()

  useEffect(() => {
    let requestId = 0
    let controller: AbortController | null = null

    async function fetchAssets() {
      if (document.hidden) return
      // A slow response must never overwrite a newer one: every request carries its own id and
      // aborts the one it replaces (the abort also covers the unmount below)
      const id = ++requestId
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        const response = await fetch('/api/markets', { signal: current.signal })
        const result = response.ok ? await response.json() : null
        if (id !== requestId || current.signal.aborted) return
        if (result?.success && result.data) {
          setAssets(result.data)
          setLastUpdate(new Date())
          setError(false)
        } else {
          setError(true)
        }
        setLoading(false)
      } catch (error) {
        if (current.signal.aborted) return
        console.error('Failed to fetch assets:', error)
        if (id !== requestId) return
        setError(true)
        setLoading(false)
      }
    }
    // SSR data can be as old as the cache, so refresh right away even when it came populated
    // (the background refresh leaves `loading` untouched, so there is no loading flash)
    fetchAssets()
    const interval = setInterval(fetchAssets, 30_000)
    // Catch up as soon as the tab is visible again instead of waiting out the interval
    const onVisible = () => {
      if (!document.hidden) fetchAssets()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reloadKey])

  // La edad del badge late con su propio tick, sin refetch: con la pestaña oculta se salta (nadie
  // mira el texto y al volver se pone al día al instante) y el intervalo se limpia al desmontar
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setDataAgeTick(Date.now())
    }
    const interval = setInterval(tick, DATA_AGE_TICK_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  // "/" enfoca la búsqueda. Solo fuera de campos: mientras se escribe en un input, select o
  // editable (o con Ctrl/Alt/Meta pulsados) la tecla sigue siendo la suya. Escape dentro del
  // input lo desenfoca y no toca al resto de handlers de la página.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const element = event.target instanceof HTMLElement ? event.target : document.activeElement
      const typing =
        element instanceof HTMLElement &&
        (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.isContentEditable)

      if (event.key === 'Escape') {
        if (element instanceof HTMLElement && element.id === SEARCH_INPUT_ID) element.blur()
        return
      }
      if (event.key !== '/' || typing || event.metaKey || event.ctrlKey || event.altKey) return
      const input = document.getElementById(SEARCH_INPUT_ID)
      if (!input) return
      event.preventDefault()
      input.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Cotización en vivo del activo mostrado (no el de la URL: un símbolo fuera del catálogo no se
  // sondea nunca): el header y el gráfico la consumen, aquí se sondea
  useEffect(() => {
    if (!activeSymbol) return
    const symbol = activeSymbol
    const controller = new AbortController()

    async function refresh() {
      if (document.hidden) return
      try {
        const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) return
        const result = await response.json()
        if (controller.signal.aborted) return
        // Una respuesta del símbolo anterior (o de uno que ya no se muestra) se descarta
        if (!result.success || result.data?.symbol !== symbol || typeof result.data.close !== 'number') return
        setLiveQuote({ symbol, close: result.data.close, change: result.data.change ?? 0, changeAbs: result.data.changeAbs ?? 0 })
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Failed to fetch live quote:', error)
      }
    }

    refresh()
    const interval = setInterval(refresh, 7_000)
    // Catch up as soon as the tab is visible again instead of waiting out the interval
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [activeSymbol])

  // The previous session's OHLC never changes intraday, so the daily pivots are fetched once
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/pivots?tf=D', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.success && Array.isArray(body.data)) {
          setPivotQuotes(new Map((body.data as PivotQuote[]).map((quote) => [quote.symbol, quote])))
        }
      })
      .catch(() => {
        // Pivots are an optional layer: without them the chart just has no pivot switch
      })
    return () => controller.abort()
  }, [])

  // The visible asset and ?activo= must say the same thing: a symbol the catalog doesn't have keeps
  // its fallback on screen, so the URL is retired here (user picks go through select() below)
  useEffect(() => {
    if (!activeSymbol || !selectedSymbol || selectedSymbol === activeSymbol) return
    window.history.replaceState(null, '', `?activo=${encodeURIComponent(activeSymbol)}`)
  }, [activeSymbol, selectedSymbol])

  // La cotización en vivo solo alimenta el activo mostrado; si no coincide, header y gráfico reciben null
  const quoteForSelection = liveQuote && liveQuote.symbol === selectedAsset?.symbol ? liveQuote : null

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
    if (sort === 'change') return [...filtered].sort(compareByChange)
    if (sort === 'name') return [...filtered].sort((a, b) => compareByName(a, b, locale))
    return filtered
  }, [filtered, sort, locale])

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

  // B2.1 — el timeframe inicial no puede salir de `pivotQuotes`: esas pivotes llegan con un fetch y
  // MarketChart solo lee `initialTimeframe` al montar, así que el mismo activo arrancaba en 1d o en
  // 1h según llegara primero el gráfico o primero la respuesta (carrera). La disponibilidad de
  // niveles para un símbolo es estática — vive en el catálogo, no en la respuesta — así que se
  // decide aquí, en el render en que el activo aparece: el valor solo cambia si cambia el símbolo,
  // con independencia del orden en que lleguen los datos. Las pivotes siguen mandando sobre los
  // niveles y el interruptor, que es donde sí corresponde reaccionar a la respuesta.
  const initialTimeframe: TimeframeKey = PIVOT_ASSET_BY_TV.has(selectedAsset?.symbol ?? '') ? '1h' : '1d'

  // Picking from the list on a wide screen needs no scroll (the chart sits beside it); anything else brings the chart into view
  function select(asset: MarketAsset, source: 'list' | 'elsewhere' = 'elsewhere') {
    setSelectedSymbol(asset.symbol)
    // Shareable link to the selected asset, without adding history entries
    window.history.replaceState(null, '', `?activo=${encodeURIComponent(asset.symbol)}`)
    if (source === 'list' && window.matchMedia(WIDE_SCREEN).matches) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    chartRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  // Enlace "Ver índice al contado" del panel de un futuro: abre el activo por su ticker, si el
  // snapshot lo tiene
  function selectBySymbol(tvSymbol: string) {
    const target = assets.find((asset) => asset.symbol === tvSymbol)
    if (!target) return
    // La pestaña activa debe contener el activo al que se navega (el contado de un futuro vive en
    // otra categoría): si no, la lista se queda sin ninguna fila resaltada
    const visible = category === 'all' || (category === 'favorites' ? favorites.includes(target.symbol) : target.category === category)
    if (!visible) setCategory(target.category as MarketCategory)
    if (search.trim() !== '') setSearch('')
    select(target)
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

  // Sin activos y fuera de la carga inicial: la API falló (o devolvió catálogo vacío)
  const unavailable = !loading && assets.length === 0
  // Sin datos buenos aún el punto no puede prometer nada "en vivo"
  const statusHealthy = !error && lastUpdate !== null
  const statusDotClass = error ? 'bg-semantic-warning' : statusHealthy ? 'bg-semantic-success' : 'bg-ink-subtle'

  // Retry del banner: relanza el sondeo sin esperar al siguiente tick de 30 s
  function retryNow() {
    setReloadKey((key) => key + 1)
  }

  // Retry desde el estado sin datos: además repinta el esqueleto mientras llega la respuesta
  function retryEmpty() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="container-wide pt-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="font-serif text-[32px] font-bold leading-tight tracking-tight text-ink">{dict.pageTitle}</h1>
            <p className="mt-1 text-[14px] text-ink-muted">{t(dict.assetCount, { n: assets.length })}</p>
          </div>
          {/* Las alertas de precio (C8) cuelgan de la cabecera: beben del sondeo del activo
              seleccionado que ya existe, así que no montan fetch propio ni pisan el pie de la
              tabla, donde viven el menú de columnas y la paginación */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span className="relative flex size-1.5" aria-hidden="true">
                {statusHealthy && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-success opacity-70 motion-reduce:animate-none" />}
                <span className={`relative inline-flex size-1.5 rounded-full ${statusDotClass}`} />
              </span>
              {lastUpdate ? (
                <span>
                  {t(dict.updatedAt, { time: lastUpdate.toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-ES') })} ·{' '}
                  <span className="tabular-nums text-ink">{formatDataAge(dataAgeTick - lastUpdate.getTime(), locale)}</span>
                </span>
              ) : error ? (
                dict.noData
              ) : (
                dict.dataLoading
              )}
            </p>
            <PriceAlerts symbol={selectedAsset?.symbol ?? null} close={quoteForSelection?.close ?? selectedAsset?.close ?? null} dict={alertsDict} />
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-[13px] text-ink">
            <span>{dict.dataError}</span>
            <button
              type="button"
              onClick={retryNow}
              className="rounded-ctl border border-semantic-warning/50 px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:bg-semantic-warning/20 focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              {dict.retry}
            </button>
          </div>
        )}

        <section ref={terminalRef} aria-label={dict.terminalAria} className="scroll-mt-[var(--header-scroll-offset)] flex flex-col gap-4 xl:grid xl:grid-cols-[340px_minmax(0,1fr)] xl:gap-6">
          <div className="relative order-2 overflow-hidden rounded-panel border border-hairline bg-surface-container-lowest xl:order-1">
            <div className="flex max-h-[460px] min-h-0 flex-col xl:absolute xl:inset-0 xl:max-h-none">
              <MarketWatchlist
                assets={listAssets}
                selectedSymbol={selectedAsset?.symbol ?? null}
                favorites={favorites}
                category={category}
                search={search}
                sort={sort}
                unavailable={unavailable}
                onCategoryChange={setCategory}
                onSearchChange={setSearch}
                onSortChange={setSort}
                onSelect={(asset) => select(asset, 'list')}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          </div>

          <div ref={chartRef} className="order-1 min-w-0 scroll-mt-[var(--header-scroll-offset)] overflow-hidden rounded-panel border border-hairline bg-surface-container-lowest xl:order-2">
            {selectedAsset ? (
              <>
                <MarketAssetHeader
                  asset={selectedAsset}
                  isFavorite={favorites.includes(selectedAsset.symbol)}
                  onToggleFavorite={() => toggleFavorite(selectedAsset.symbol)}
                  liveQuote={quoteForSelection}
                />
                <div className="mt-5 border-y border-hairline">
                  <MarketChart
                    bare
                    symbol={selectedAsset.symbol}
                    name={selectedAsset.name}
                    height={440}
                    levels={pivotLevels}
                    levelsLabel={dict.pivotLevelsLabel}
                    initialTimeframe={initialTimeframe}
                    liveQuote={quoteForSelection}
                    delayMinutes={selectedAsset.delayMinutes}
                  />
                </div>
                <AssetDetailPanel key={selectedAsset.symbol} asset={selectedAsset} onSelectSymbol={selectBySymbol} />
              </>
            ) : loading ? (
              <div className="h-[720px] animate-pulse motion-reduce:animate-none bg-surface-1" role="status" aria-live="polite">
                <span className="sr-only">{dict.assetLoading}</span>
              </div>
            ) : (
              <div role="alert" className="flex h-[720px] flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="material-symbols-outlined mb-2 text-[40px] text-semantic-warning" aria-hidden="true">
                  error
                </span>
                <p className="text-[16px] font-medium text-ink">{dict.assetsUnavailable}</p>
                <p className="max-w-sm text-[13px] text-ink-muted">{dict.assetsUnavailableHint}</p>
                <button type="button" onClick={retryEmpty} className="btn-primary mt-4">
                  {dict.retry}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-20" aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="font-serif text-[22px] font-bold tracking-tight text-ink">
            {dict.overviewHeading}
          </h2>
          <p className="mb-10 mt-1 max-w-2xl text-[14px] text-ink-muted">{dict.overviewSubtitle}</p>
          <MarketOverview assets={assets} onSelect={(asset) => select(asset)} onSelectCategory={showCategory} />
        </section>

        <section className="mt-20">
          <CryptoRankings />
        </section>

        <section className="mt-20" aria-labelledby="screener-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 id="screener-heading" className="font-serif text-[22px] font-bold tracking-tight text-ink">
                {dict.screenerHeading}
              </h2>
              <p className="mt-1 max-w-2xl text-[14px] text-ink-muted">{dict.screenerSubtitle}</p>
            </div>
            <p className="text-[13px] text-ink-muted">
              {t(dict.screenerCount, { filtered: filtered.length, total: assets.length })}
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="ml-3 text-accent-blue hover:text-accent-blue-hover">
                  {dict.clearFilters}
                </button>
              )}
            </p>
          </div>
          <AssetTable
            assets={filtered}
            loading={loading}
            unavailable={unavailable}
            selectedSymbol={selectedAsset?.symbol ?? null}
            onSelectAsset={(asset) => select(asset)}
            resetKey={`${category}|${search}`}
            emptyMessage={category === 'favorites' ? dict.emptyFavorites : dict.emptyFiltered}
          />
        </section>
      </div>
    </main>
  )
}
