'use client'

import { clsx } from 'clsx'
import { formatLevel } from '@/lib/format'
import type { PivotAsset } from '@/lib/pivot-assets'
import type { PivotQuote } from '@/lib/pivot-data'
import { distancePct, type PivotLevel, type PricePosition } from '@/lib/pivots'
import { t } from '@/lib/i18n/get-dictionary'
import { useLocale, useDictionary } from '@/lib/i18n/LocaleProvider'

export interface PivotRow {
  asset: PivotAsset
  quote: PivotQuote
  levels: PivotLevel[]
  position: PricePosition
}

interface PivotAssetListProps {
  rows: PivotRow[]
  selected: string | null
  favorites: string[]
  loading?: boolean
  onSelect: (tv: string) => void
  onToggleFavorite: (tv: string) => void
}

const GRID =
  'grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)]'

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function RangeBar({ levels, price }: { levels: PivotLevel[]; price: number }) {
  const values = levels.map((level) => level.value)
  const low = Math.min(...values, price)
  const high = Math.max(...values, price)
  const span = high - low || 1
  const at = (value: number) => `${Math.min(100, Math.max(0, ((value - low) / span) * 100))}%`
  const pivot = levels.find((level) => level.kind === 'pivot')

  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-gradient-to-r from-semantic-danger/35 via-accent-blue/25 to-semantic-success/35" aria-hidden="true">
        {pivot && <span className="absolute -top-0.5 h-2.5 w-0.5 -translate-x-1/2 rounded-full bg-accent-blue" style={{ left: at(pivot.value) }} />}
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-container-lowest bg-ink"
          style={{ left: at(price) }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-subtle" aria-hidden="true">
        <span>{levels[levels.length - 1]?.label}</span>
        <span>{levels[0]?.label}</span>
      </div>
    </div>
  )
}

const KIND_TEXT = { resistance: 'text-semantic-success', pivot: 'text-accent-blue', support: 'text-semantic-danger' } as const

function LevelCell({ level, price, symbol }: { level: PivotLevel | null; price: number; symbol: string }) {
  if (!level) return <span className="text-body-sm text-ink-subtle">—</span>
  // Colored by the level itself: when the price breaks out, the nearest support can be an R level
  const color = KIND_TEXT[level.kind]
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className={clsx('text-[11px] font-bold', color)}>{level.label}</span>
        <span className="font-mono text-body-sm tabular-nums text-ink">{formatLevel(level.value, price, symbol)}</span>
      </p>
      <p className="font-mono text-[10px] tabular-nums text-ink-muted">{signed(distancePct(level.value, price))}</p>
    </div>
  )
}

export function PivotAssetList({ rows, selected, favorites, loading = false, onSelect, onToggleFavorite }: PivotAssetListProps) {
  const { locale } = useLocale()
  const dict = useDictionary()
  const listDict = dict.pivotAssetList

  if (loading) {
    return (
      <ul className="divide-y divide-hairline-soft" aria-busy="true" aria-label={listDict.loadingAria}>
        {Array.from({ length: 7 }, (_, index) => (
          <li key={index} className="px-4 py-4">
            <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <div
        className={clsx(GRID, 'hidden border-b border-outline-variant/40 py-2.5 pl-12 pr-4 text-micro font-bold uppercase tracking-wider text-ink-muted md:grid')}
        aria-hidden="true"
      >
        <span>{listDict.colAsset}</span>
        <span>{listDict.colPrice}</span>
        <span>{listDict.colNextSupport}</span>
        <span>{listDict.colNextResistance}</span>
        <span>{listDict.colLevelRange}</span>
      </div>

      <ul className="divide-y divide-hairline-soft">
        {rows.map(({ asset, quote, levels, position }) => {
          const isSelected = selected === asset.tv
          const isFavorite = favorites.includes(asset.tv)
          const up = quote.change >= 0
          return (
            <li key={asset.tv} className="relative">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(asset.tv)}
                className={clsx(
                  GRID,
                  'w-full py-3.5 pl-12 pr-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-blue',
                  isSelected ? 'bg-accent-blue/8 shadow-[inset_2px_0_0_var(--accent-blue)]' : 'hover:bg-surface-2/50'
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-body-sm font-bold text-ink">{asset.label}</span>
                    {position.bias !== 'neutral' && (
                      <span
                        className={clsx('text-[9px]', position.bias === 'bullish' ? 'text-semantic-success' : 'text-semantic-danger')}
                        role="img"
                        aria-label={position.bias === 'bullish' ? listDict.biasBullishAria : listDict.biasBearishAria}
                      >
                        {position.bias === 'bullish' ? '▲' : '▼'}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-micro text-ink-muted">{locale === 'en' ? asset.nameEn : asset.name}</span>
                </span>

                <span>
                  <span className="block font-mono text-body-sm font-bold tabular-nums text-ink">
                    {formatLevel(quote.price, quote.price, asset.tv)}
                  </span>
                  <span className={clsx('block font-mono text-[10px] font-semibold tabular-nums', up ? 'text-semantic-success' : 'text-semantic-danger')}>
                    {signed(quote.change)}
                  </span>
                </span>

                <LevelCell level={position.support} price={quote.price} symbol={asset.tv} />
                <LevelCell level={position.resistance} price={quote.price} symbol={asset.tv} />

                <span className="col-span-2 md:col-span-1">
                  <RangeBar levels={levels} price={quote.price} />
                </span>
              </button>

              <button
                type="button"
                aria-pressed={isFavorite}
                aria-label={t(isFavorite ? dict.marketWatchlist.removeAria : dict.marketWatchlist.addAria, { name: asset.label })}
                onClick={() => onToggleFavorite(asset.tv)}
                className="absolute left-2.5 top-3 flex size-8 items-center justify-center rounded-full text-ink-subtle transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
              >
                <span
                  className={clsx('material-symbols-outlined text-[20px]', isFavorite && 'text-semantic-warning')}
                  style={isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  aria-hidden="true"
                >
                  star
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
