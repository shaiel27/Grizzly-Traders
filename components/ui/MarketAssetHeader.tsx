'use client'

import { clsx } from 'clsx'
import { formatCompact, formatNumber, formatPrice } from '@/lib/format'
import { type MarketCategory } from '@/lib/market-assets'
import { rangePosition } from '@/lib/market-analysis'
import type { MarketItem } from '@/lib/markets'
import { t } from '@/lib/i18n/get-dictionary'
import { useLocale, useDictionary } from '@/lib/i18n/LocaleProvider'

// Mismo patron que AssetTable.tsx/MarketWatchlist.tsx: `description` llega en español desde el
// catálogo (lib/assets-catalog.ts); en inglés se usa `descriptionEn` cuando existe.
function localizedDescription(asset: MarketItem, locale: string): string {
  return locale === 'en' && asset.descriptionEn ? asset.descriptionEn : asset.description
}

interface MarketAssetHeaderProps {
  asset: MarketItem
  isFavorite: boolean
  onToggleFavorite: () => void
}

function RangeBar({
  label,
  low,
  high,
  value,
  format,
  ofRangeTemplate,
}: {
  label: string
  low: number
  high: number
  value: number
  format: (value: number) => string
  ofRangeTemplate: string
}) {
  const position = rangePosition(value, low, high)
  if (position === null) return null

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
        <span className="text-ink-muted">{label}</span>
        <span className="tabular-nums text-ink-subtle">{t(ofRangeTemplate, { pct: position.toFixed(0) })}</span>
      </div>
      <div className="relative h-1 rounded-full bg-surface-2">
        <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface-container-lowest" style={{ left: `${position}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] tabular-nums text-ink-muted">
        <span>{format(low)}</span>
        <span>{format(high)}</span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd className="text-[13px] tabular-nums text-ink">{value}</dd>
    </div>
  )
}

export function MarketAssetHeader({ asset, isFavorite, onToggleFavorite }: MarketAssetHeaderProps) {
  const { locale } = useLocale()
  const dict = useDictionary()
  const up = asset.change >= 0
  const format = (value: number) => formatPrice(value, asset.symbol)
  const volume = asset.volume > 0 ? formatCompact(asset.volume) : '—'
  const categoryLabel = dict.marketCategories[asset.category as MarketCategory] ?? asset.category

  return (
    <div className="px-5 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{asset.name}</h2>
            <button
              type="button"
              aria-pressed={isFavorite}
              aria-label={t(isFavorite ? dict.marketWatchlist.removeAria : dict.marketWatchlist.addAria, { name: asset.name })}
              onClick={onToggleFavorite}
              className={clsx(
                'flex size-7 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                isFavorite ? 'text-semantic-warning' : 'text-ink-subtle hover:text-ink'
              )}
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: `'FILL' ${isFavorite ? 1 : 0}` }} aria-hidden="true">
                star
              </span>
            </button>
          </div>
          <p className="text-[13px] text-ink-muted">
            {localizedDescription(asset, locale)} <span className="text-ink-subtle">({categoryLabel})</span>
          </p>
        </div>

        <div className="text-right tabular-nums">
          <p className="text-[28px] font-semibold leading-none tracking-tight text-ink">{format(asset.close)}</p>
          <p className={clsx('mt-1.5 text-[14px]', up ? 'text-semantic-success' : 'text-semantic-danger')}>
            {up ? '+' : '-'}
            {formatNumber(Math.abs(asset.changeAbs ?? 0), 2)}
            <span className="ml-2">
              {up ? '+' : ''}
              {asset.change?.toFixed(2)}%
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-4 border-t border-hairline-soft pt-4 md:grid-cols-[auto_1fr_1fr]">
        <dl className="grid grid-cols-4 gap-x-6 md:grid-cols-2 md:gap-y-2">
          <Stat label={dict.marketAssetHeader.statOpen} value={format(asset.open)} />
          <Stat label={dict.marketAssetHeader.statVolume} value={volume} />
          <Stat label={dict.marketAssetHeader.statHigh} value={format(asset.high)} />
          <Stat label={dict.marketAssetHeader.statLow} value={format(asset.low)} />
        </dl>
        <RangeBar
          label={dict.marketAssetHeader.dayRange}
          low={asset.low}
          high={asset.high}
          value={asset.close}
          format={format}
          ofRangeTemplate={dict.marketAssetHeader.ofRange}
        />
        <RangeBar
          label={dict.marketAssetHeader.range52w}
          low={asset.low52w}
          high={asset.high52w}
          value={asset.close}
          format={format}
          ofRangeTemplate={dict.marketAssetHeader.ofRange}
        />
      </div>
    </div>
  )
}
