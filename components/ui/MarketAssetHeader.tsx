'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { formatChangeAbs, formatCompact, formatPrice } from '@/lib/format'
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
  // Cotización en vivo del terminal; cuando llega, manda sobre los valores del snapshot de la lista
  liveQuote?: { close: number; change?: number; changeAbs?: number } | null
}

// Mismo flash que AssetTable.tsx/LiveTicker.tsx, con la misma duración que .ticker-flash-* en
// globals.css: el precio en vivo del sondeo de 7 s ahora señala el cambio igual que la tabla.
// La animación expira (dir vuelve a null) para que al re-montar no se reproduzca un flash viejo,
// y el flash lleva su símbolo para que al cambiar de activo no se pinte sobre el precio nuevo.
const FLASH_MS = 1400

interface HeaderFlash {
  symbol: string
  dir: 'up' | 'down' | null
  tick: number
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

// Rótulo corto con explicación: el texto largo va en `title` (puntero) y en un sr-only (lectores de
// pantalla), porque un title solo no llega al teclado ni al tacto
function InfoChip({ label, hint }: { label: string; hint?: string }) {
  return (
    <li title={hint} className="inline-flex items-center rounded-full border border-hairline px-2.5 py-0.5 text-[12px] text-ink-muted">
      {label}
      {hint && <span className="sr-only">. {hint}</span>}
    </li>
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

export function MarketAssetHeader({ asset, isFavorite, onToggleFavorite, liveQuote }: MarketAssetHeaderProps) {
  const { locale } = useLocale()
  const dict = useDictionary()
  const close = liveQuote?.close ?? asset.close
  const [flash, setFlash] = useState<HeaderFlash | null>(null)
  const previousRef = useRef<{ symbol: string; close: number } | null>(null)
  const tickRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function expire() {
      timerRef.current = null
      setFlash((current) => (current ? { ...current, dir: null } : current))
    }

    const previous = previousRef.current
    if (!previous || previous.symbol !== asset.symbol) {
      // Al cambiar de activo la referencia arranca de cero: el precio nuevo no hereda el flash del anterior
      previousRef.current = { symbol: asset.symbol, close }
    } else if (previous.close !== close) {
      previousRef.current = { symbol: asset.symbol, close }
      tickRef.current += 1
      setFlash({ symbol: asset.symbol, dir: close > previous.close ? 'up' : 'down', tick: tickRef.current })
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(expire, FLASH_MS)
    } else if (flash?.dir && flash.symbol === asset.symbol && !timerRef.current) {
      // React remonta los effects en dev y la limpieza cancela el timer: un flash activo sin timer
      // se vuelve a armar, para que la animación no se quede pintada para siempre
      timerRef.current = setTimeout(expire, FLASH_MS)
    }
  }, [close, asset.symbol, flash])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const change = liveQuote?.change ?? asset.change
  const changeAbs = liveQuote?.changeAbs ?? asset.changeAbs
  const hasChange = Number.isFinite(change)
  const hasChangeAbs = Number.isFinite(changeAbs)
  const up = hasChange ? change >= 0 : changeAbs >= 0
  const changeText = hasChange ? `${up ? '+' : ''}${change.toFixed(2)}%` : '—'
  const changeAbsText = hasChangeAbs ? `${up ? '+' : '-'}${formatChangeAbs(changeAbs, close, asset.symbol)}` : '—'
  const format = (value: number) => formatPrice(value, asset.symbol)
  const volume = asset.volume > 0 ? formatCompact(asset.volume) : '—'
  const categoryLabel = dict.marketCategories[asset.category as MarketCategory] ?? asset.category
  // Solo se pinta el flash del activo que se está viendo: al cambiar de activo, el flash anterior
  // no debe cruzarse con el precio nuevo
  const shownFlash = flash && flash.symbol === asset.symbol ? flash : null
  // Chips de contexto: el contrato continuo (solo futuros), el retraso del dato (cualquier activo
  // que el scanner marque diferido, también el S&P al contado) y la moneda de cotización del futuro
  const isFuture = asset.category === 'future'
  const hasChips = isFuture || asset.delayMinutes !== null

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
            {localizedDescription(asset, locale)}
            {/* Los futuros ya llevan el tipo en el nombre ("Futuro DAX"): repetirlo sobra */}
            {!isFuture && <span className="text-ink-subtle"> ({categoryLabel})</span>}
          </p>
          {hasChips && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {isFuture && <InfoChip label={dict.marketAssetHeader.continuousContract} hint={dict.marketAssetHeader.continuousContractHint} />}
              {asset.delayMinutes !== null && (
                <InfoChip
                  label={t(dict.marketAssetHeader.delayed, { min: asset.delayMinutes })}
                  hint={t(dict.marketAssetHeader.delayedHint, { min: asset.delayMinutes })}
                />
              )}
              {isFuture && asset.currency && <InfoChip label={t(dict.marketAssetHeader.quoteCurrency, { currency: asset.currency })} />}
            </ul>
          )}
        </div>

        <div className="text-right tabular-nums">
          <p className="text-[28px] font-semibold leading-none tracking-tight text-ink">
            <span key={shownFlash?.tick ?? 0} className={clsx('inline-block rounded', shownFlash?.dir && `ticker-flash-${shownFlash.dir}`)}>
              {format(close)}
            </span>
          </p>
          <p className={clsx('mt-1.5 text-[14px]', hasChange || hasChangeAbs ? (up ? 'text-semantic-success' : 'text-semantic-danger') : 'text-ink-muted')}>
            {changeAbsText}
            <span className="ml-2">{changeText}</span>
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
          low={Math.min(asset.low, close)}
          high={Math.max(asset.high, close)}
          value={close}
          format={format}
          ofRangeTemplate={dict.marketAssetHeader.ofRange}
        />
        <RangeBar
          label={dict.marketAssetHeader.range52w}
          low={asset.low52w}
          high={asset.high52w}
          value={close}
          format={format}
          ofRangeTemplate={dict.marketAssetHeader.ofRange}
        />
      </div>
    </div>
  )
}
