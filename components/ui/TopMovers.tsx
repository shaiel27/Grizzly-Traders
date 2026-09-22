'use client'

import { clsx } from 'clsx'

interface Mover {
  symbol: string
  name: string
  description?: string
  change: number
}

interface TopMoversProps<T extends Mover> {
  assets: T[]
  onSelect: (asset: T) => void
  count?: number
  // Layout of the two lists; side by side by default, pass a single-column class for a narrow column
  className?: string
}

function MoverList<T extends Mover>({ title, items, onSelect }: { title: string; items: T[]; onSelect: (asset: T) => void }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1 text-[13px] font-semibold text-ink">{title}</h3>
      <ul>
        {items.map((asset) => (
          <li key={asset.symbol} className="border-b border-hairline-soft last:border-b-0">
            <button
              type="button"
              onClick={() => onSelect(asset)}
              className="flex w-full items-baseline justify-between gap-3 py-2 text-left transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <span className="min-w-0 truncate text-[13px] text-ink-muted hover:text-ink">{asset.name}</span>
              <span className={clsx('shrink-0 text-[13px] tabular-nums', asset.change >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                {asset.change >= 0 ? '+' : ''}
                {asset.change.toFixed(2)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TopMovers<T extends Mover>({ assets, onSelect, count = 5, className = 'grid gap-x-8 gap-y-6 sm:grid-cols-2' }: TopMoversProps<T>) {
  const valid = assets.filter((asset) => Number.isFinite(asset.change))
  const sorted = [...valid].sort((a, b) => b.change - a.change)

  if (valid.length < count * 2) return null

  return (
    <div className={className}>
      <MoverList title="Mayores subidas" items={sorted.slice(0, count)} onSelect={onSelect} />
      <MoverList title="Mayores bajadas" items={sorted.slice(-count).reverse()} onSelect={onSelect} />
    </div>
  )
}
