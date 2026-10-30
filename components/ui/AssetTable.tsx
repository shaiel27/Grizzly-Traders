'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { clsx } from 'clsx'
import { sanitizeStoredColumns } from '@/lib/columns'
import { formatCompact, formatNumber, formatPrice } from '@/lib/format'
import { t } from '@/lib/i18n/get-dictionary'
import { useLocale, useDictionary } from '@/lib/i18n/LocaleProvider'
import { pageCount, pageSlice } from '@/lib/pagination'
import { PageControls } from './PageControls'
import { rsiReading, signalFor, type Tone } from '@/lib/market-analysis'
import type { MarketItem as MarketAsset } from '@/lib/markets'

// Fase 5 del plan de cobertura en inglés: `description` llega en español desde el catálogo
// (lib/assets-catalog.ts); en inglés se usa `descriptionEn` cuando existe, nunca al revés.
function localizedDescription(asset: MarketAsset, locale: string): string {
  return locale === 'en' && asset.descriptionEn ? asset.descriptionEn : asset.description
}

interface Flash {
  // null = el flash ya expiró; la entrada (y su tick) se conservan para no re-montar el span
  dir: 'up' | 'down' | null
  tick: number
}

// Duración de .ticker-flash-up/.ticker-flash-down en globals.css: el flash se apaga cuando la
// animación termina
const FLASH_MS = 1400

// Filas por página del screener (ajuste de sesión, sin persistir); el selector de abajo lo cambia
const PAGE_SIZES = [25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

// El icono de copiar vuelve a content_copy pasado el rato, como en PivotCalculator.tsx
const COPIED_MS = 1500

// Mismo patron que LiveTicker.tsx (ticker-flash-up/down + remontar por key para reiniciar la
// animacion): esta tabla recibe `assets` entero de nuevo cada 30s (MarketsClient.tsx) pero antes
// no habia ninguna señal visual de que un precio cambio, solo el numero distinto. La comparacion
// con el precio anterior vive en un ref (no en el cuerpo del render, para no mutar durante el
// render) y se actualiza en un efecto; el mapa de flashes en si es estado porque SI dispara un
// repintado (la animacion).
// El flash expiraba nunca: la clase seguía en el DOM y re-montar la fila (paginación, cambio de
// orden, volver de otro filtro) reproducía una animación vieja como si el precio acabara de
// cambiar — un flash falso. Ahora se apaga a los FLASH_MS.
function usePriceFlash(assets: MarketAsset[]): Map<string, Flash> {
  const prevCloseRef = useRef<Map<string, number>>(new Map())
  const ticksRef = useRef<Map<string, number>>(new Map())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [flashes, setFlashes] = useState<Map<string, Flash>>(new Map())

  useEffect(() => {
    // El updater lee los refs de precios: sincronizar estado con un ref mutable es lo que un effect
    // debe hacer (y es lo único que el lint de React permite aquí), mientras que derivar el nuevo
    // estado de props/state en un effect provoca un render en cascada
    setFlashes((prevFlashes) => {
      let changed = false
      const next = new Map(prevFlashes)
      for (const asset of assets) {
        const prevClose = prevCloseRef.current.get(asset.symbol)
        if (prevClose !== undefined && prevClose !== asset.close) {
          const tick = (ticksRef.current.get(asset.symbol) ?? 0) + 1
          ticksRef.current.set(asset.symbol, tick)
          next.set(asset.symbol, { dir: asset.close > prevClose ? 'up' : 'down', tick })
          changed = true
        }
        prevCloseRef.current.set(asset.symbol, asset.close)
      }
      return changed ? next : prevFlashes
    })
  }, [assets])

  // Los timers son un sistema externo: se arman (y re-arman tras el remontado de dev, que los
  // cancela al desmontar) y se apagan cuando el flash expira, en el callback del setTimeout
  useEffect(() => {
    for (const [symbol, flash] of flashes) {
      if (!flash.dir || timersRef.current.has(symbol)) continue
      timersRef.current.set(
        symbol,
        setTimeout(() => {
          timersRef.current.delete(symbol)
          setFlashes((current) => {
            const active = current.get(symbol)
            if (!active?.dir) return current
            const expired = new Map(current)
            expired.set(symbol, { ...active, dir: null })
            return expired
          })
        }, FLASH_MS)
      )
    }
  }, [flashes])

  // Limpieza al desmontar. En dev React remonta los effects: el effect de arriba vuelve a poner en
  // marcha los timers que sigan activos, así que el flash no se queda colgado ni ahí
  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
    },
    []
  )

  return flashes
}

type SortKey = keyof MarketAsset

// Columnas configurables (C7): claves en orden canónico de render — la lista de etiquetas de
// `columns` (dentro del componente) debe recorrerse en este mismo orden. `name` es el ancla de la
// fila: nunca se puede ocultar (su checkbox va deshabilitado), así que la tabla siempre tiene al
// menos una columna visible.
const COLUMN_KEYS: readonly SortKey[] = [
  'name',
  'close',
  'change',
  'volume',
  'marketCap',
  'rsi',
  'adx',
  'recommendAll',
  'perf1M',
  'perf3M',
  'perfY',
]
const ANCHOR_COLUMN: SortKey = 'name'
const COLUMNS_STORAGE_KEY = 'gt:markets:columns:v1'

// Column visibility as an external store (same pattern as lib/watchlist.ts): el snapshot es el
// string crudo — React lo compara por valor, así que no hace falta cachear nada intermedio — y el
// parsing vive en el useMemo de abajo. Cualquier sorpresa (storage bloqueado, otra pestaña)
// se resuelve en el propio parse: null = "sin elección guardada" = defaults
const columnListeners = new Set<() => void>()

function subscribeColumnVisibility(listener: () => void) {
  columnListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    columnListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function getColumnVisibility(): string {
  try {
    return window.localStorage.getItem(COLUMNS_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

// SSR e hidratación: sin localStorage se pintan los defaults; si hay algo guardado, React re-renderiza
// con el snapshot real del cliente en cuanto termina la hidratación (sin mismatch, sin effect)
function getServerColumnVisibility(): string {
  return ''
}

function parseColumnVisibility(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeStoredColumns(keys: readonly string[]) {
  try {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // storage unavailable (private mode): nothing to persist
  }
  columnListeners.forEach((listener) => listener())
}

interface AssetTableProps {
  assets: MarketAsset[]
  loading?: boolean
  // True when nothing loaded at all (API outage): the empty message must not blame the filters
  unavailable?: boolean
  selectedSymbol?: string | null
  emptyMessage?: string
  // Changing this (filters, search) sends the table back to its first page
  resetKey?: string
  onSelectAsset?: (asset: MarketAsset) => void
}

const TONE_TEXT: Record<Tone, string> = {
  positive: 'text-semantic-success',
  negative: 'text-semantic-danger',
  neutral: 'text-ink-muted',
}

function pct(value: number | null | undefined, decimals = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

function tone(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) || value === 0 ? 'text-ink-muted' : value > 0 ? 'text-semantic-success' : 'text-semantic-danger'
}

export function AssetTable({
  assets,
  loading = false,
  unavailable = false,
  selectedSymbol = null,
  emptyMessage,
  resetKey = '',
  onSelectAsset,
}: AssetTableProps) {
  const { locale } = useLocale()
  const dict = useDictionary()
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [seenResetKey, setSeenResetKey] = useState(resetKey)
  // Símbolo recién copiado: el icono pasa a `check` durante COPIED_MS y el aviso se retira con él
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null)
  const storedColumnVisibility = useSyncExternalStore(subscribeColumnVisibility, getColumnVisibility, getServerColumnVisibility)
  const visibleKeys = useMemo(
    () => sanitizeStoredColumns(parseColumnVisibility(storedColumnVisibility), COLUMN_KEYS, COLUMN_KEYS),
    [storedColumnVisibility]
  )
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
  // Roving tabindex dentro del menú de columnas (mismo patrón que el menú de indicadores de MarketChart)
  const [columnsMenuFocus, setColumnsMenuFocus] = useState(0)
  const columnsMenuRef = useRef<HTMLDivElement>(null)
  const columnsMenuButtonRef = useRef<HTMLButtonElement>(null)
  const flashes = usePriceFlash(assets)

  // Cierra el menú de columnas al pulsar fuera o con Escape; Escape además devuelve el foco al
  // botón que lo abrió, para que un usuario de teclado no quede perdido en la cima del documento
  useEffect(() => {
    if (!columnsMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!columnsMenuRef.current?.contains(event.target as Node)) setColumnsMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setColumnsMenuOpen(false)
      columnsMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [columnsMenuOpen])

  // Un menú se abre ya enfocado en su primer elemento marcable; el roving tabindex le sigue
  useEffect(() => {
    if (!columnsMenuOpen) return
    columnsMenuRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus()
  }, [columnsMenuOpen])

  useEffect(() => {
    if (!copiedSymbol) return
    const timer = setTimeout(() => setCopiedSymbol(null), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copiedSymbol])

  const columns: { key: SortKey; label: string; align?: 'right' | 'left' }[] = [
    { key: 'name', label: dict.assetTable.colAsset, align: 'left' },
    { key: 'close', label: dict.assetTable.colPrice, align: 'right' },
    { key: 'change', label: dict.assetTable.colChange, align: 'right' },
    { key: 'volume', label: dict.assetTable.colVolume, align: 'right' },
    { key: 'marketCap', label: dict.assetTable.colMarketCap, align: 'right' },
    { key: 'rsi', label: dict.assetTable.colRsi, align: 'right' },
    { key: 'adx', label: dict.assetTable.colAdx, align: 'right' },
    { key: 'recommendAll', label: dict.assetTable.colSignal, align: 'right' },
    { key: 'perf1M', label: dict.assetTable.colPerf1M, align: 'right' },
    { key: 'perf3M', label: dict.assetTable.colPerf3M, align: 'right' },
    { key: 'perfY', label: dict.assetTable.colPerfY, align: 'right' },
  ]

  // El ancla se fuerza aquí y no en el estado: sea cual sea lo que venga del storage, la cabecera,
  // las celdas y el checkbox de Nombre salen siempre consistentes
  const visibleSet = new Set<string>([...visibleKeys, ANCHOR_COLUMN])
  const visibleColumns = columns.filter((column) => visibleSet.has(column.key))

  // Ocultar la columna ordenada no reordena nada: `sorted` se calcula con sortKey aunque no se
  // muestre, así que el orden sigue siendo coherente (y al volver a mostrarla apunta igual)
  function toggleColumn(key: SortKey) {
    const next = visibleKeys.includes(key)
      ? visibleKeys.filter((item) => item !== key)
      : COLUMN_KEYS.filter((item) => visibleKeys.includes(item) || item === key)
    // El estado vive en el storage: escribir y notificar es lo que provoca el re-render
    writeStoredColumns(next)
  }

  // Mismo teclado que el menú de indicadores de MarketChart: Tab cierra y deja seguir al foco,
  // ↑/↓ recorren los elementos marcables (la columna ancla, deshabilitada, se salta)
  function onColumnsMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      setColumnsMenuOpen(false)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = Array.from(columnsMenuRef.current?.querySelectorAll<HTMLInputElement>('input:not(:disabled)') ?? [])
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLInputElement)
    const offset = event.key === 'ArrowDown' ? 1 : -1
    const next = current === -1 ? (offset > 0 ? items[0] : items[items.length - 1]) : items[(current + offset + items.length) % items.length]
    if (!next) return
    event.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest' })
  }

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

  async function copySymbol(symbol: string) {
    try {
      await navigator.clipboard.writeText(symbol)
      setCopiedSymbol(symbol)
    } catch {
      // clipboard blocked (insecure context or denied permission): nothing to fall back to
    }
  }

  // Roving tabindex: only one row sits in the tab order at a time (the selected one, else the first
  // visible). ↑/↓ move the cursor between rows and Enter/Space selects, so the rows — que son
  // clickeables — también se alcanzan con teclado; el botón del nombre sigue siendo su propio punto
  // de entrada dentro de la fila.
  const [focusSymbol, setFocusSymbol] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const activeSymbol = visible.some((asset) => asset.symbol === focusSymbol)
    ? focusSymbol
    : (visible.find((asset) => asset.symbol === selectedSymbol)?.symbol ?? visible[0]?.symbol ?? null)

  function onRowKeyDown(event: ReactKeyboardEvent<HTMLTableRowElement>, asset: MarketAsset, index: number) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      // El botón del nombre se activa solo con Enter: la fila solo actúa cuando ella es el destino
      if (event.target !== event.currentTarget) return
      event.preventDefault()
      onSelectAsset?.(asset)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const next = visible[index + (event.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    event.preventDefault()
    setFocusSymbol(next.symbol)
    rowRefs.current.get(next.symbol)?.focus()
  }

  if (loading) {
    return (
      <div className="space-y-1" aria-busy="true" aria-label={dict.assetTable.loadingAria}>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-sm bg-surface-1" />
        ))}
      </div>
    )
  }

  if (sorted.length === 0) {
    // Sin datos cargados el mensaje de filtros seria mentira: aqui no hay nada que filtrar
    const message = unavailable ? dict.assetTable.unavailable : (emptyMessage ?? dict.assetTable.emptyDefault)
    return <p className="border-y border-hairline-soft py-10 text-center text-[13px] text-ink-muted">{message}</p>
  }

  return (
    <div>
      <span role="status" className="sr-only">
        {copiedSymbol ? t(dict.assetTable.copiedSymbol, { symbol: copiedSymbol }) : ''}
      </span>
      <ul className="md:hidden">
        {visible.map((asset) => {
          const rec = signalFor(asset.recommendAll)
          const isSelected = selectedSymbol === asset.symbol
          const flash = flashes.get(asset.symbol)
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
                  <span className="block truncate text-[12px] text-ink-muted">{localizedDescription(asset, locale)}</span>
                </span>
                <span className="text-right tabular-nums">
                  <span
                    key={flash?.tick ?? 0}
                    className={clsx('block rounded text-[14px] text-ink', flash?.dir && `ticker-flash-${flash.dir}`)}
                  >
                    {formatPrice(asset.close, asset.symbol)}
                  </span>
                  <span className={clsx('block text-[13px]', tone(asset.change))}>{pct(asset.change)}</span>
                </span>
                <span className="col-span-2 flex items-center gap-4 text-[12px] text-ink-muted">
                  <span>
                    {dict.assetTable.colRsi} <span className="tabular-nums text-ink">{asset.rsi ? asset.rsi.toFixed(0) : '—'}</span>
                    {asset.rsi ? <span className="sr-only"> ({dict.marketAnalysis[rsiReading(asset.rsi).key]})</span> : null}
                  </span>
                  <span>
                    {dict.assetTable.colPerf1M} <span className={clsx('tabular-nums', tone(asset.perf1M))}>{pct(asset.perf1M, 1)}</span>
                  </span>
                  <span className={clsx('ml-auto', TONE_TEXT[rec.tone])}>{dict.marketAnalysis[rec.key]}</span>
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
              {visibleColumns.map((column) => (
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
            {visible.map((asset, index) => {
              const rec = signalFor(asset.recommendAll)
              const rsi = rsiReading(asset.rsi)
              const isSelected = selectedSymbol === asset.symbol
              const flash = flashes.get(asset.symbol)
              return (
                <tr
                  key={asset.symbol}
                  ref={(node) => {
                    if (node) rowRefs.current.set(asset.symbol, node)
                    else rowRefs.current.delete(asset.symbol)
                  }}
                  tabIndex={asset.symbol === activeSymbol ? 0 : -1}
                  aria-selected={isSelected || undefined}
                  onFocus={() => setFocusSymbol(asset.symbol)}
                  onKeyDown={(event) => onRowKeyDown(event, asset, index)}
                  onClick={() => onSelectAsset?.(asset)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={clsx(
                    'cursor-pointer border-b border-hairline-soft transition-colors',
                    isSelected ? 'bg-surface-1 shadow-[inset_2px_0_0_var(--accent-blue)]' : 'hover:bg-surface-1/60'
                  )}
                >
                  {/* Ancla de la fila (Nombre): sin condición, siempre está en visibleSet */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelectAsset?.(asset)
                        }}
                        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-accent-blue"
                      >
                        <span className="block truncate font-medium text-ink">{asset.name}</span>
                        <span className="block truncate text-[12px] text-ink-muted">{localizedDescription(asset, locale)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          copySymbol(asset.symbol)
                        }}
                        aria-label={t(dict.assetTable.copySymbolAria, { symbol: asset.symbol })}
                        title={t(dict.assetTable.copySymbolAria, { symbol: asset.symbol })}
                        className={clsx(
                          'shrink-0 rounded-xs p-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                          copiedSymbol === asset.symbol ? 'text-semantic-success' : 'text-ink-subtle hover:bg-surface-1 hover:text-ink'
                        )}
                      >
                        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                          {copiedSymbol === asset.symbol ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </td>
                  {visibleSet.has('close') && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                      <span
                        key={flash?.tick ?? 0}
                        className={clsx('rounded px-1', flash?.dir && `ticker-flash-${flash.dir}`)}
                      >
                        {formatPrice(asset.close, asset.symbol)}
                      </span>
                    </td>
                  )}
                  {visibleSet.has('change') && (
                    <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.change))}>{pct(asset.change)}</td>
                  )}
                  {visibleSet.has('volume') && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{asset.volume > 0 ? formatCompact(asset.volume) : '—'}</td>
                  )}
                  {visibleSet.has('marketCap') && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{asset.marketCap > 0 ? formatNumber(asset.marketCap, 0, 1) : '—'}</td>
                  )}
                  {visibleSet.has('rsi') && (
                    <td className={clsx('px-3 py-2.5 text-right tabular-nums', asset.rsi ? TONE_TEXT[rsi.tone] : 'text-ink-subtle')} title={dict.marketAnalysis[rsi.key]}>
                      {asset.rsi ? asset.rsi.toFixed(1) : '—'}
                      {asset.rsi ? <span className="sr-only"> ({dict.marketAnalysis[rsi.key]})</span> : null}
                    </td>
                  )}
                  {visibleSet.has('adx') && (
                    <td className={clsx('px-3 py-2.5 text-right tabular-nums', asset.adx >= 25 ? 'text-ink' : 'text-ink-muted')}>{asset.adx ? asset.adx.toFixed(1) : '—'}</td>
                  )}
                  {visibleSet.has('recommendAll') && (
                    <td className={clsx('whitespace-nowrap px-3 py-2.5 text-right', TONE_TEXT[rec.tone])}>{dict.marketAnalysis[rec.key]}</td>
                  )}
                  {visibleSet.has('perf1M') && (
                    <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.perf1M))}>{pct(asset.perf1M, 1)}</td>
                  )}
                  {visibleSet.has('perf3M') && (
                    <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.perf3M))}>{pct(asset.perf3M, 1)}</td>
                  )}
                  {visibleSet.has('perfY') && (
                    <td className={clsx('px-3 py-2.5 text-right tabular-nums', tone(asset.perfY))}>{pct(asset.perfY, 1)}</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-muted">
            {dict.assetTable.pageSizeLabel}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(0)
              }}
              className="rounded-ctl border border-hairline-soft bg-surface-1 px-2 py-1 text-[13px] text-ink transition-colors hover:border-hairline focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              {PAGE_SIZES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {/* Columnas: solo desktop. La lista móvil de arriba es una ficha fija (nombre, precio,
              cambio, RSI, 1 mes y señal) sin estructura de columnas, así que en móvil este
              conmutador no cambiaría nada — un control que miente es peor que no estar */}
          <div ref={columnsMenuRef} className="relative hidden md:block">
            <button
              type="button"
              ref={columnsMenuButtonRef}
              aria-expanded={columnsMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setColumnsMenuOpen((value) => !value)
                setColumnsMenuFocus(0)
              }}
              className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline-soft bg-surface-1 px-2.5 py-1 text-[13px] text-ink transition-colors hover:border-hairline focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                visibility
              </span>
              {dict.assetTable.columnsLabel}
            </button>

            {columnsMenuOpen && (
              <div
                role="menu"
                aria-label={dict.assetTable.columnsLabel}
                onKeyDown={onColumnsMenuKeyDown}
                className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-sm border border-hairline bg-surface-container-low p-1 shadow-xl"
              >
                {columns.map((column, index) => {
                  const isAnchor = column.key === ANCHOR_COLUMN
                  return (
                    <label
                      key={column.key}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-ctl px-2.5 py-2 text-[13px]',
                        isAnchor ? 'cursor-not-allowed text-ink-subtle' : 'cursor-pointer text-ink hover:bg-surface-2'
                      )}
                      title={isAnchor ? dict.assetTable.columnsAnchorFixed : undefined}
                    >
                      <input
                        type="checkbox"
                        role="menuitemcheckbox"
                        aria-checked={visibleSet.has(column.key)}
                        checked={visibleSet.has(column.key)}
                        tabIndex={index === columnsMenuFocus ? 0 : -1}
                        onFocus={() => setColumnsMenuFocus(index)}
                        onChange={() => toggleColumn(column.key)}
                        disabled={isAnchor}
                        className="size-3.5 accent-[var(--accent-blue)]"
                      />
                      {column.label}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <PageControls page={currentPage} total={sorted.length} pageSize={pageSize} onPageChange={setPage} label={dict.assetTable.paginationLabel} className="flex-1" />
      </div>
    </div>
  )
}
