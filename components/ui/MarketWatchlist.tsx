'use client'

import { clsx } from 'clsx'
import { formatPrice } from '@/lib/format'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import { MARKET_CATEGORY_LABELS, type MarketCategory } from '@/lib/market-assets'
import type { MarketItem } from '@/lib/markets'

export type WatchlistCategory = 'all' | 'favorites' | MarketCategory
export type WatchlistSort = 'default' | 'change' | 'name'

interface MarketWatchlistProps {
  assets: MarketItem[]
  selectedSymbol: string | null
  favorites: string[]
  category: WatchlistCategory
  search: string
  sort: WatchlistSort
  onCategoryChange: (category: WatchlistCategory) => void
  onSearchChange: (search: string) => void
  onSortChange: (sort: WatchlistSort) => void
  onSelect: (asset: MarketItem) => void
  onToggleFavorite: (symbol: string) => void
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function MarketWatchlist({
  assets,
  selectedSymbol,
  favorites,
  category,
  search,
  sort,
  onCategoryChange,
  onSearchChange,
  onSortChange,
  onSelect,
  onToggleFavorite,
}: MarketWatchlistProps) {
  const dict = useDictionary().marketWatchlist

  const categories: { key: WatchlistCategory; label: string }[] = [
    { key: 'all', label: dict.categoryAll },
    { key: 'favorites', label: dict.categoryFavorites },
    ...(Object.entries(MARKET_CATEGORY_LABELS) as [MarketCategory, string][]).map(([key, label]) => ({ key, label })),
  ]

  const sorts: { key: WatchlistSort; label: string }[] = [
    { key: 'default', label: dict.sortDefault },
    { key: 'change', label: dict.sortChange },
    { key: 'name', label: dict.sortName },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-hairline-soft p-3">
        <div className="relative">
          <label htmlFor="watchlist-search" className="sr-only">
            {dict.searchLabel}
          </label>
          <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-ink-subtle" aria-hidden="true">
            search
          </span>
          <input
            id="watchlist-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={dict.searchPlaceholder}
            autoComplete="off"
            className="h-9 w-full rounded-[8px] border border-hairline bg-surface-1 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:outline-none"
          />
        </div>

        <div role="group" aria-label={dict.categoryAria} className="flex flex-wrap gap-1">
          {categories.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={category === option.key}
              onClick={() => onCategoryChange(option.key)}
              className={clsx(
                'h-7 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                category === option.key ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-1 hover:text-ink'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-hairline-soft px-3 py-1.5 text-[12px] text-ink-subtle">
        <span aria-live="polite">{t(dict.countLabel, { n: assets.length })}</span>
        <div role="group" aria-label={dict.sortAria} className="flex items-center gap-0.5">
          {sorts.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={sort === option.key}
              onClick={() => onSortChange(option.key)}
              className={clsx('rounded px-1.5 py-0.5 transition-colors', sort === option.key ? 'text-ink' : 'hover:text-ink')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-ink-muted">
          {category === 'favorites' ? dict.emptyFavorites : dict.emptySearch}
        </p>
      ) : (
        <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {assets.map((asset) => {
            const isSelected = asset.symbol === selectedSymbol
            const isFavorite = favorites.includes(asset.symbol)
            const up = asset.change >= 0
            return (
              <li key={asset.symbol} className="group relative border-b border-hairline-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(asset)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={clsx(
                    'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2 pl-8 pr-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-blue',
                    isSelected ? 'bg-surface-1 shadow-[inset_2px_0_0_var(--accent-blue)]' : 'hover:bg-surface-1/60'
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{asset.name}</span>
                    <span className="block truncate text-[12px] text-ink-muted">{asset.description}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-[13px] text-ink">{formatPrice(asset.close, asset.symbol)}</span>
                    <span className={clsx('block text-[12px]', up ? 'text-semantic-success' : 'text-semantic-danger')}>{signed(asset.change)}</span>
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={isFavorite}
                  aria-label={t(isFavorite ? dict.removeAria : dict.addAria, { name: asset.name })}
                  onClick={() => onToggleFavorite(asset.symbol)}
                  className={clsx(
                    'absolute left-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-blue',
                    isFavorite ? 'text-semantic-warning opacity-100' : 'text-ink-subtle opacity-0 hover:text-ink group-hover:opacity-100'
                  )}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: `'FILL' ${isFavorite ? 1 : 0}` }}
                    aria-hidden="true"
                  >
                    star
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
