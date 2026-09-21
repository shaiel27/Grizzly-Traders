'use client'

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { useWatchlist } from '@/lib/watchlist'
import { formatNumber, formatPrice } from '@/lib/format'
import type { MarketItem as MarketAsset } from '@/lib/markets'

type SortKey = keyof MarketAsset

interface AssetTableProps {
  assets: MarketAsset[]
  loading: boolean
  onSelectAsset?: (asset: MarketAsset) => void
}

const CATEGORIES = [
  { key: 'all', label: 'Todos', icon: 'apps' },
  { key: 'watchlist', label: 'Favoritos', icon: 'star' },
  { key: 'crypto', label: 'Crypto', icon: 'currency_bitcoin' },
  { key: 'forex', label: 'Forex', icon: 'currency_exchange' },
  { key: 'commodity', label: 'Materias Primas', icon: 'oil_barrel' },
  { key: 'stock', label: 'Acciones', icon: 'show_chart' },
  { key: 'index', label: 'Índices', icon: 'candlestick_chart' },
]

function formatVolume(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return '—'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function getRSIColor(rsi: number): string {
  if (rsi >= 70) return 'text-semantic-danger'
  if (rsi <= 30) return 'text-semantic-success'
  return 'text-ink'
}

function getRecommendBadge(value: number): { label: string; color: string } {
  if (value >= 0.5) return { label: 'Fuerte Compra', color: 'bg-semantic-success/15 text-semantic-success border-semantic-success/30' }
  if (value >= 0.2) return { label: 'Compra', color: 'bg-semantic-success/10 text-semantic-success border-semantic-success/20' }
  if (value <= -0.5) return { label: 'Fuerte Venta', color: 'bg-semantic-danger/15 text-semantic-danger border-semantic-danger/30' }
  if (value <= -0.2) return { label: 'Venta', color: 'bg-semantic-danger/10 text-semantic-danger border-semantic-danger/20' }
  return { label: 'Neutral', color: 'bg-surface-2 text-ink-muted border-outline-variant/30' }
}

const SORT_COLUMNS: { key: SortKey; label: string; align?: string }[] = [
  { key: 'name', label: 'Activo' },
  { key: 'close', label: 'Precio', align: 'right' },
  { key: 'change', label: 'Cambio %', align: 'right' },
  { key: 'volume', label: 'Volumen', align: 'right' },
  { key: 'marketCap', label: 'Market Cap', align: 'right' },
  { key: 'rsi', label: 'RSI', align: 'right' },
  { key: 'adx', label: 'ADX', align: 'right' },
  { key: 'atr', label: 'ATR', align: 'right' },
  { key: 'recommendAll', label: 'Señal', align: 'center' },
  { key: 'perf1M', label: '1M', align: 'right' },
  { key: 'perf3M', label: '3M', align: 'right' },
  { key: 'perfY', label: 'YTD', align: 'right' },
]

export function AssetTable({ assets, loading, onSelectAsset }: AssetTableProps) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const watchlist = useWatchlist()

  const filtered = useMemo(() => {
    let result = assets
    if (activeCategory === 'watchlist') {
      result = result.filter((a) => watchlist.symbols.includes(a.symbol))
    } else if (activeCategory !== 'all') {
      result = result.filter((a) => a.category === activeCategory)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      const an = (av as number) ?? 0
      const bn = (bv as number) ?? 0
      return sortDir === 'asc' ? an - bn : bn - an
    })
    return result
  }, [assets, activeCategory, search, sortKey, sortDir, watchlist.symbols])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-surface-2 rounded-xl animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-14 bg-surface-2 rounded-lg animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              aria-pressed={activeCategory === cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all',
                activeCategory === cat.key
                  ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                  : 'border-outline-variant/40 bg-surface-2/50 text-ink-muted hover:border-outline-variant hover:text-ink'
              )}
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-ink-muted" aria-hidden="true">search</span>
          <input
            type="search"
            aria-label="Buscar activo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar activo..."
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-2/50 pl-9 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-micro text-ink-muted">
          {filtered.length} activos {activeCategory !== 'all' ? `en ${CATEGORIES.find((c) => c.key === activeCategory)?.label}` : ''}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                {SORT_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={clsx(
                      'px-4 py-3 text-micro font-bold text-ink-muted uppercase tracking-wider whitespace-nowrap',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className={clsx(
                        'flex w-full items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink',
                        col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                      )}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                          {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => {
                const isPositive = asset.change >= 0
                const rec = getRecommendBadge(asset.recommendAll)

                return (
                  <tr
                    key={asset.symbol}
                    onClick={() => onSelectAsset?.(asset)}
                    className="border-b border-outline-variant/20 cursor-pointer transition-colors hover:bg-accent-blue/5"
                  >
                    {/* Activo */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            watchlist.toggle(asset.symbol)
                          }}
                          aria-pressed={watchlist.has(asset.symbol)}
                          aria-label={`${watchlist.has(asset.symbol) ? 'Quitar de' : 'Añadir a'} favoritos: ${asset.name}`}
                          className={clsx(
                            'shrink-0 rounded-full p-1 transition-colors',
                            watchlist.has(asset.symbol) ? 'text-gradient-orange' : 'text-ink-subtle hover:text-ink'
                          )}
                        >
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ fontVariationSettings: `'FILL' ${watchlist.has(asset.symbol) ? 1 : 0}` }}
                            aria-hidden="true"
                          >
                            star
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectAsset?.(asset)
                          }}
                          className="text-left"
                        >
                          <span className="block font-bold text-ink text-sm">{asset.name}</span>
                          <span className="block text-micro text-ink-muted">{asset.description}</span>
                        </button>
                      </div>
                    </td>

                    {/* Precio */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm font-bold tabular-nums text-ink">
                        {formatPrice(asset.close, asset.symbol)}
                      </span>
                    </td>

                    {/* Cambio % */}
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-mono text-sm font-bold tabular-nums', isPositive ? 'text-semantic-success' : 'text-semantic-danger')}>
                        {isPositive ? '+' : ''}{asset.change.toFixed(2)}%
                      </span>
                    </td>

                    {/* Volumen */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm tabular-nums text-ink-muted">{formatVolume(asset.volume)}</span>
                    </td>

                    {/* Market Cap */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm tabular-nums text-ink-muted">{formatNumber(asset.marketCap, 0, 1)}</span>
                    </td>

                    {/* RSI */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full', asset.rsi >= 70 ? 'bg-semantic-danger' : asset.rsi <= 30 ? 'bg-semantic-success' : 'bg-accent-blue')}
                            style={{ width: `${Math.min(100, asset.rsi)}%` }}
                          />
                        </div>
                        <span className={clsx('font-mono text-xs font-bold tabular-nums', getRSIColor(asset.rsi))}>
                          {asset.rsi ? asset.rsi.toFixed(1) : '—'}
                        </span>
                      </div>
                    </td>

                    {/* ADX */}
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-mono text-xs font-bold tabular-nums', asset.adx >= 25 ? 'text-accent-blue' : 'text-ink-muted')}>
                        {asset.adx ? asset.adx.toFixed(1) : '—'}
                      </span>
                    </td>

                    {/* ATR */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs tabular-nums text-ink-muted">{asset.atr ? formatNumber(asset.atr) : '—'}</span>
                    </td>

                    {/* Señal */}
                    <td className="px-4 py-3 text-center">
                      <span className={clsx('inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold', rec.color)}>
                        {rec.label}
                      </span>
                    </td>

                    {/* 1M */}
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-mono text-xs tabular-nums', (asset.perf1M ?? 0) >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                        {asset.perf1M != null ? `${asset.perf1M >= 0 ? '+' : ''}${asset.perf1M.toFixed(1)}%` : '—'}
                      </span>
                    </td>

                    {/* 3M */}
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-mono text-xs tabular-nums', (asset.perf3M ?? 0) >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                        {asset.perf3M != null ? `${asset.perf3M >= 0 ? '+' : ''}${asset.perf3M.toFixed(1)}%` : '—'}
                      </span>
                    </td>

                    {/* YTD */}
                    <td className="px-4 py-3 text-right">
                      <span className={clsx('font-mono text-xs tabular-nums', (asset.perfY ?? 0) >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                        {asset.perfY != null ? `${asset.perfY >= 0 ? '+' : ''}${asset.perfY.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-6 py-12 text-center text-body-sm text-ink-muted">
            {activeCategory === 'watchlist'
              ? 'Aún no tienes favoritos. Toca la estrella de un activo para añadirlo.'
              : 'No hay activos que coincidan con tu búsqueda.'}
          </p>
        )}
      </div>
    </div>
  )
}
