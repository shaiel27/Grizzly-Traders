'use client'

import { clsx } from 'clsx'

interface Mover {
  symbol: string
  name: string
  change: number
}

interface TopMoversProps<T extends Mover> {
  assets: T[]
  onSelect: (asset: T) => void
  count?: number
}

function MoverList<T extends Mover>({
  title,
  icon,
  items,
  tone,
  onSelect,
}: {
  title: string
  icon: string
  items: T[]
  tone: 'up' | 'down'
  onSelect: (asset: T) => void
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-caption font-bold text-ink">
        <span
          className={clsx('material-symbols-outlined text-[18px]', tone === 'up' ? 'text-semantic-success' : 'text-semantic-danger')}
          aria-hidden="true"
        >
          {icon}
        </span>
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map((asset) => (
          <li key={asset.symbol}>
            <button
              type="button"
              onClick={() => onSelect(asset)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60"
            >
              <span className="truncate text-body-sm font-medium text-ink">{asset.name}</span>
              <span
                className={clsx(
                  'shrink-0 font-mono text-body-sm font-bold tabular-nums',
                  asset.change >= 0 ? 'text-semantic-success' : 'text-semantic-danger'
                )}
              >
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

export function TopMovers<T extends Mover>({ assets, onSelect, count = 5 }: TopMoversProps<T>) {
  const valid = assets.filter((asset) => Number.isFinite(asset.change))
  const sorted = [...valid].sort((a, b) => b.change - a.change)
  const gainers = sorted.slice(0, count)
  const losers = sorted.slice(-count).reverse()

  if (valid.length < count * 2) return null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <MoverList title="Mayores subidas" icon="trending_up" items={gainers} tone="up" onSelect={onSelect} />
      <MoverList title="Mayores bajadas" icon="trending_down" items={losers} tone="down" onSelect={onSelect} />
    </div>
  )
}
