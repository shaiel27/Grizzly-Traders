'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { formatCompact, formatNumber, formatPrice } from '@/lib/format'
import { pageCount, pageSlice } from '@/lib/pagination'
import { PageControls } from './PageControls'
import { rsiReading, signalFor, type Tone } from '@/lib/market-analysis'
import type { MarketItem as MarketAsset } from '@/lib/markets'

type SortKey = keyof MarketAsset

interface AssetTableProps {
  assets: MarketAsset[]
  loading?: boolean
  selectedSymbol?: string | null
  emptyMessage?: string
  // Rows per page
  pageSize?: number
  // Changing this (filters, search) sends the table back to its first page
  resetKey?: string
  onSelectAsset?: (asset: MarketAsset) => void
}

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-semantic-success',
  negative: 'text-semantic-danger',
  neutral: 'text-ink-muted',
}

const COLUMNS: { key: SortKey; label: string; align?: 'right' | 'left' }[] = [
  { key: 'name', label: 'Activo', align: 'left' },
  { key: 'close', label: 'Precio', align: 'right' },
  { key: 'change', label: 'Variación', align: 'right' },
  { key: 'volume', label: 'Volumen', align: 'right' },
  { key: 'marketCap', label: 'Capitalización', align: 'right' },
  { key: 'rsi', label: 'RSI', align: 'right' },
  { key: 'adx', label: 'ADX', align: 'right' },
  { key: 'recommendAll', label: 'Señal', align: 'right' },
  { key: 'perf1M', label: '1 mes', align: 'right' },
  { key: 'perf3M', label: '3 meses', align: 'right' },
  { key: 'perfY', label: '1 año', align: 'right' },
]

function pct(value: number | null | undefined, decimals = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

function tone(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) || value === 0 ? 'text-ink-muted' : value > 0 ? 'text-semantic-success' : 'text-semantic-danger'
}

export function AssetTable({ assets, loading = false, selectedSymbol = null, emptyMessage, pageSize = 5, resetKey = '', onSelectAsset }: AssetTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [seenResetKey, setSeenResetKey] = useState(resetKey)

  // Resetting state while rendering (instead of in an effect) avoids painting the old page for a frame
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey)
    setPage(0)
  }

  const sorted = useMemo(
    () =>
      [...assets].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        const an = (av as number) ?? 0
        const bn = (bv as number) ?? 0
        return sortDir === 'asc' ? an - bn : bn - an
      }),
    [assets, sortKey, sortDir]
  )

  const totalPages = pageCount(sorted.length, pageSize)
  const currentPage = Math.min(page, totalPages - 1)
  const visible = pageSlice(sorted, currentPage, pageSize)

  function handleSort(key: SortKey) {
    setPage(0)
    if (sortKey === key) setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  if (loading) {
    return (
      <div className="space-y-1" aria-busy="true" aria-label="Cargando activos">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-sm bg-surface-1" />
        ))}
      </div>
    )
  }

  if (sorted.length === 0) {
    return <p className="border-y border-hairline-soft py-10 text-center text-[13px] text-ink-muted">{emptyMessage ?? 'No hay activos para mostrar.'}</p>
  }

  return (
    <div>
      <ul className="md:hidden">
        {visible.map((asset) => {
          const rec = signalFor(asset.recommendAll)
          const isSelected = selectedSymbol === asset.symbol
          return (
            <li key={asset.symbol} className="border-b border-hairline-soft">
              <button
                type="button"
                onClick={() => onSelectAsset?.(asset)}
                aria-current={isSelected ? 'true' : undefined}
                className={clsx(
                  'grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-1 py-3 text-left',
                  isSelected && 'bg-surface-1 shadow-[inset_2px_0_0_var(--accent-blue)]'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink">{asset.name}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{asset.description}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block text-[14px] text-ink">{formatPrice(asset.close, asset.symbol)}</span>
                  <span className={clsx('block text-[13px]', tone(asset.change))}>{pct(asset.change)}</span>
                </span>
                <span className="col-span-2 flex items-center gap-4 text-[12px] text-ink-muted">
                  <span>
                    RSI <span className="tabular-nums text-ink">{asset.rsi ? asset.rsi.toFixed(0) : '—'}</span>
                    {asset.rsi ? <span className="sr-only"> ({rsiReading(asset.rsi).label})</span> : null}
                  </span>
                  <span>
                    1 mes <span className={clsx('tabular-nums', tone(asset.perf1M))}>{pct(asset.perf1M, 1)}</span>
                  </span>
                  <span className={clsx('ml-auto', TONE_TEXT[rec.tone])}>{rec.label}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="scroll-thin hidden overflow-x-auto md:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-hairline">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={clsx('whitespace-nowrap px-3 py-2.5 font-normal', column.align === 'left' ? 'text-left' : 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className={clsx(
                      'inline-flex items-center gap-1 text-[12px] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue',
                      sortKey === column.key ? 'text-ink' : 'text-ink-muted'
                    )}
                  >
                    {column.label}
                    {sortKey === column.key && (
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                        {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((asset) => {
              const rec = signalFor(asset.recommendAll)
              const rsi = rsiReading(asset.rsi)
              const isSelected = selectedSymbol === asset.symbol
              return (
                <tr
                  key={asset.symbol}
                  onClick={() => onSelectAsset?.(asset)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={clsx(
                    'cursor-pointer border-b border-hairline-soft transition-colors',
                    isSelected ? 'bg-surface-1 shadow-[inset_2px_0_0_var(--accent-blue)]' : 'hover:bg-surface-1/60'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelectAsset?.(asset)
                      }}
                      className="text-left focus-visible:outline-2 focus-visible:outline-accent-blue"
                    >
                      <span className="block font-medium text-ink">{asset.name}</span>
                      <span className="block text-[12px] text-ink-muted">{asset.description}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{formatPrice(asset.close, asset.symbol)}</td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.change))}>{pct(asset.change)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{asset.volume > 0 ? formatCompact(asset.volume) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{asset.marketCap > 0 ? formatNumber(asset.marketCap, 0, 1) : '—'}</td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums', asset.rsi ? TONE_TEXT[rsi.tone] : 'text-ink-subtle')} title={rsi.label}>
                    {asset.rsi ? asset.rsi.toFixed(1) : '—'}
                    {asset.rsi ? <span className="sr-only"> ({rsi.label})</span> : null}
                  </td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums', asset.adx >= 25 ? 'text-ink' : 'text-ink-muted')}>{asset.adx ? asset.adx.toFixed(1) : '—'}</td>
                  <td className={clsx('whitespace-nowrap px-3 py-2.5 text-right', TONE_TEXT[rec.tone])}>{rec.label}</td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.perf1M))}>{pct(asset.perf1M, 1)}</td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.perf3M))}>{pct(asset.perf3M, 1)}</td>
                  <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.perfY))}>{pct(asset.perfY, 1)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <PageControls page={currentPage} total={sorted.length} pageSize={pageSize} onPageChange={setPage} label="Paginación del análisis técnico" className="mt-4" />
    </div>
  )
}
