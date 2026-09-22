'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { formatLevel } from '@/lib/format'
import { PIVOT_ASSET_BY_TV, PIVOT_ASSETS, PIVOT_CATEGORIES, POPULAR_PIVOT_ASSETS } from '@/lib/pivot-assets'
import type { PivotQuote } from '@/lib/pivot-data'
import { PIVOT_METHOD_INFO } from '@/lib/pivot-methods'
import {
  PIVOT_METHODS,
  analyzePosition,
  calculatePivots,
  distancePct,
  findConfluences,
  levelsFor,
  parseDecimal,
  validateOhlc,
  type OhlcErrors,
  type PivotLevel,
  type PivotMethod,
} from '@/lib/pivots'
import { PivotLadder } from './PivotLadder'

interface PivotCalculatorProps {
  quotes: PivotQuote[]
  timeframeLabel: string
  periodLabel: string
  // Asset selected in the page, offered as a one-click load
  selectedAsset?: string | null
}

type Field = 'open' | 'high' | 'low' | 'close' | 'price'
type FormState = Record<Field, string>
type FormErrors = OhlcErrors & { price?: string }

const EMPTY_FORM: FormState = { open: '', high: '', low: '', close: '', price: '' }

const FIELDS: { key: Field; label: string; hint: string; accent: string }[] = [
  { key: 'open', label: 'Apertura (O)', hint: 'Opcional, solo DeMark', accent: 'text-ink' },
  { key: 'high', label: 'Máximo (H)', hint: 'Del período anterior', accent: 'text-semantic-success' },
  { key: 'low', label: 'Mínimo (L)', hint: 'Del período anterior', accent: 'text-semantic-danger' },
  { key: 'close', label: 'Cierre (C)', hint: 'Del período anterior', accent: 'text-accent-blue' },
  { key: 'price', label: 'Precio actual', hint: 'Opcional, marca la posición', accent: 'text-ink' },
]

const TOLERANCES = [0.05, 0.1, 0.25, 0.5]

// Row order of the comparison matrix, highest level first
const MATRIX_ROWS: [key: string, label: string][] = [
  ['r4', 'R4'],
  ['r3', 'R3'],
  ['r2', 'R2'],
  ['r1', 'R1'],
  ['pivot', 'PP'],
  ['s1', 'S1'],
  ['s2', 'S2'],
  ['s3', 'S3'],
  ['s4', 'S4'],
]

const KIND_TEXT = { resistance: 'text-semantic-success', pivot: 'text-accent-blue', support: 'text-semantic-danger' } as const

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function InputField({
  id,
  label,
  hint,
  accent,
  value,
  error,
  onChange,
  onBlur,
}: {
  id: string
  label: string
  hint: string
  accent: string
  value: string
  error?: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  return (
    <div>
      <label htmlFor={id} className={clsx('mb-1.5 block text-micro font-medium', accent)}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-note`}
        className={clsx(
          'w-full rounded-lg border bg-surface-2 px-3 py-2.5 font-mono text-sm text-ink transition-colors placeholder:text-ink-subtle focus:outline-none focus:ring-1',
          error
            ? 'border-semantic-danger/60 focus:border-semantic-danger focus:ring-semantic-danger/30'
            : 'border-outline-variant/40 focus:border-accent-blue focus:ring-accent-blue/30'
        )}
      />
      <p id={`${id}-note`} className={clsx('mt-1 text-[11px]', error ? 'text-semantic-danger' : 'text-ink-subtle')}>
        {error ?? hint}
      </p>
    </div>
  )
}

export function PivotCalculator({ quotes, timeframeLabel, periodLabel, selectedAsset }: PivotCalculatorProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [assetTv, setAssetTv] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [modified, setModified] = useState(false)
  const [livePrice, setLivePrice] = useState(false)
  const [method, setMethod] = useState<PivotMethod>('classic')
  const [tolerance, setTolerance] = useState(0.1)
  const [copied, setCopied] = useState<string | null>(null)

  const quoteByTv = useMemo(() => new Map(quotes.map((quote) => [quote.symbol, quote])), [quotes])
  const liveQuote = livePrice && assetTv ? quoteByTv.get(assetTv) : undefined
  // While "live" is on, the price follows the polled quote instead of the typed text
  const priceText = liveQuote ? String(liveQuote.price) : form.price

  const parsed = useMemo(() => {
    const numbers = {
      open: parseDecimal(form.open),
      high: parseDecimal(form.high),
      low: parseDecimal(form.low),
      close: parseDecimal(form.close),
      price: parseDecimal(priceText),
    }
    const errors: FormErrors = validateOhlc({ high: numbers.high, low: numbers.low, close: numbers.close, open: numbers.open })
    if (priceText.trim() !== '' && !(numbers.price > 0)) errors.price = 'Debe ser un número mayor que 0'
    return { numbers, errors }
  }, [form.open, form.high, form.low, form.close, priceText])

  const { numbers, errors } = parsed
  const ready = Object.keys(errors).length === 0
  const symbol = assetTv ?? ''
  const price = numbers.price > 0 ? numbers.price : numbers.close

  const result = useMemo(
    () => (ready ? calculatePivots(numbers.high, numbers.low, numbers.close, Number.isNaN(numbers.open) ? numbers.close : numbers.open) : null),
    [ready, numbers]
  )
  const levels = useMemo(() => (result ? levelsFor(result, method) : []), [result, method])
  const position = useMemo(() => (levels.length ? analyzePosition(levels, price) : null), [levels, price])
  const confluences = useMemo(() => (result ? findConfluences(result, tolerance) : []), [result, tolerance])
  const confluentCells = useMemo(
    () => new Set(confluences.flatMap((confluence) => confluence.levels.map((level) => `${level.method}:${level.label}`))),
    [confluences]
  )

  const shownError = (field: Field) => (touched[field] || form[field].trim() !== '' ? errors[field] : undefined)

  function setField(field: Field, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'price') setLivePrice(false)
    else setModified(true)
  }

  function loadAsset(tv: string) {
    const quote = quoteByTv.get(tv)
    if (!quote) return
    setForm({
      open: String(quote.previous.open),
      high: String(quote.previous.high),
      low: String(quote.previous.low),
      close: String(quote.previous.close),
      price: String(quote.price),
    })
    setTouched({})
    setAssetTv(tv)
    setLivePrice(true)
    setSource(`${PIVOT_ASSET_BY_TV.get(tv)?.name ?? tv} · ${periodLabel} (${timeframeLabel})`)
    setModified(false)
  }

  function clearForm() {
    setForm(EMPTY_FORM)
    setTouched({})
    setAssetTv(null)
    setSource(null)
    setModified(false)
    setLivePrice(false)
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500)
    } catch {
      // clipboard blocked (insecure context or denied permission): nothing to fall back to
    }
  }

  const copyAllText = (list: PivotLevel[]) =>
    [
      `${assetTv ? PIVOT_ASSET_BY_TV.get(assetTv)?.label : 'Pivot points'} · ${PIVOT_METHOD_INFO[method].label}`,
      ...list.map((level) => `${level.label}: ${formatLevel(level.value, price, symbol)}`),
    ].join('\n')

  const range = numbers.high - numbers.low
  const hasAnyValue = Object.values(form).some((value) => value.trim() !== '')
  const availablePresets = POPULAR_PIVOT_ASSETS.filter((tv) => PIVOT_ASSET_BY_TV.has(tv))

  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/40 bg-surface-container-low px-6 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-headline font-bold text-ink">
            <span className="material-symbols-outlined text-[20px] text-accent-blue" aria-hidden="true">
              calculate
            </span>
            Calculadora de Pivot Points
          </h2>
          <p className="mt-0.5 text-body-sm text-ink-muted">Carga un activo o escribe los datos del período anterior.</p>
        </div>
        {hasAnyValue && (
          <button
            type="button"
            onClick={clearForm}
            className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-micro text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="space-y-6 p-6">
        <section aria-labelledby="calc-asset-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h3 id="calc-asset-heading" className="text-micro font-bold uppercase tracking-wider text-ink-muted">
              Cargar un activo
            </h3>
            <p className="text-micro text-ink-subtle">
              Período: <span className="font-bold text-ink">{timeframeLabel}</span> ({periodLabel}). Se cambia arriba en la página.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedAsset && PIVOT_ASSET_BY_TV.has(selectedAsset) && !availablePresets.includes(selectedAsset) && (
              <button
                type="button"
                onClick={() => loadAsset(selectedAsset)}
                disabled={!quoteByTv.has(selectedAsset)}
                className="rounded-xl border border-accent-blue/50 bg-accent-blue/10 px-3 py-2 text-xs font-bold text-accent-blue transition-colors hover:bg-accent-blue/20 disabled:opacity-40"
              >
                Usar {PIVOT_ASSET_BY_TV.get(selectedAsset)?.label}
              </button>
            )}
            {availablePresets.map((tv) => {
              const asset = PIVOT_ASSET_BY_TV.get(tv)!
              const active = assetTv === tv
              return (
                <button
                  key={tv}
                  type="button"
                  aria-pressed={active}
                  disabled={!quoteByTv.has(tv)}
                  onClick={() => loadAsset(tv)}
                  className={clsx(
                    'rounded-xl border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    active
                      ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                      : 'border-outline-variant/40 bg-surface-2/50 text-ink-muted hover:border-outline-variant hover:bg-surface-2 hover:text-ink'
                  )}
                >
                  {asset.label}
                </button>
              )
            })}

            <label className="sr-only" htmlFor="calc-asset-select">
              Más activos
            </label>
            <select
              id="calc-asset-select"
              value=""
              onChange={(event) => event.target.value && loadAsset(event.target.value)}
              className="rounded-xl border border-outline-variant/40 bg-surface-2/50 px-3 py-2 text-xs font-bold text-ink-muted transition-colors hover:border-outline-variant focus:border-accent-blue focus:outline-none"
            >
              <option value="">Más activos…</option>
              {PIVOT_CATEGORIES.map((category) => (
                <optgroup key={category.key} label={category.label}>
                  {PIVOT_ASSETS.filter((asset) => asset.category === category.key).map((asset) => (
                    <option key={asset.tv} value={asset.tv} disabled={!quoteByTv.has(asset.tv)}>
                      {asset.label} — {asset.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {source && (
            <p className="mt-3 flex items-center gap-1.5 text-micro text-ink-muted" role="status">
              <span className="material-symbols-outlined text-[14px] text-semantic-success" aria-hidden="true">
                check_circle
              </span>
              Datos cargados: {source}
              {modified && ' (modificado)'}
              {livePrice && <span className="text-ink-subtle"> · precio actual en vivo</span>}
            </p>
          )}
        </section>

        <section aria-labelledby="calc-inputs-heading">
          <h3 id="calc-inputs-heading" className="sr-only">
            Datos del período
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {FIELDS.map((field) => (
              <InputField
                key={field.key}
                id={`pivot-input-${field.key}`}
                label={field.label}
                hint={field.hint}
                accent={field.accent}
                value={field.key === 'price' ? priceText : form[field.key]}
                error={shownError(field.key)}
                onChange={(value) => setField(field.key, value)}
                onBlur={() => setTouched((current) => ({ ...current, [field.key]: true }))}
              />
            ))}
          </div>
          <p className="mt-2 text-micro text-ink-subtle">
            Los niveles se calculan con el máximo, mínimo y cierre del período anterior. Acepta punto o coma como separador decimal.
          </p>
        </section>

        {ready && result && position ? (
          <>
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-outline-variant/20 bg-surface-2/40 px-4 py-3 text-center sm:flex sm:items-center sm:gap-8 sm:text-left">
              <div>
                <p className="text-micro text-ink-muted">Rango</p>
                <p className="font-mono text-sm font-bold tabular-nums text-ink">{formatLevel(range, price, symbol)}</p>
              </div>
              <div>
                <p className="text-micro text-ink-muted">Volatilidad</p>
                <p className="font-mono text-sm font-bold tabular-nums text-ink">{((range / numbers.close) * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-micro text-ink-muted">Cierre en el rango</p>
                <p className={clsx('font-mono text-sm font-bold tabular-nums', numbers.close >= (numbers.high + numbers.low) / 2 ? 'text-semantic-success' : 'text-semantic-danger')}>
                  {range > 0 ? (((numbers.close - numbers.low) / range) * 100).toFixed(0) : '50'}%
                </p>
              </div>
            </div>

            <section aria-labelledby="calc-method-heading">
              <h3 id="calc-method-heading" className="sr-only">
                Método de cálculo
              </h3>
              <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1" role="group" aria-label="Método">
                {PIVOT_METHODS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={method === option}
                    onClick={() => setMethod(option)}
                    className={clsx(
                      'flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all',
                      method === option ? 'bg-surface-container-lowest text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    {PIVOT_METHOD_INFO[option].label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-accent-blue/20 bg-accent-blue/5 px-4 py-3">
                <p className="text-body-sm text-ink">{PIVOT_METHOD_INFO[method].description}</p>
                <p className="mt-1 font-mono text-xs text-accent-blue">{PIVOT_METHOD_INFO[method].formula}</p>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <PivotLadder levels={levels} price={price} symbol={symbol} />

              <div className="rounded-xl border border-outline-variant/40 bg-surface-2/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-micro font-bold uppercase tracking-wider text-ink-muted">Niveles · {PIVOT_METHOD_INFO[method].label}</h3>
                  <button
                    type="button"
                    onClick={() => copy(copyAllText(levels), 'all')}
                    className="flex items-center gap-1 rounded-lg border border-outline-variant/40 px-2.5 py-1 text-micro text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      {copied === 'all' ? 'check' : 'content_copy'}
                    </span>
                    {copied === 'all' ? 'Copiado' : 'Copiar todo'}
                  </button>
                </div>

                <table className="w-full text-left">
                  <caption className="sr-only">Niveles del método {PIVOT_METHOD_INFO[method].label} y su distancia al precio actual</caption>
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-ink-subtle">
                      <th scope="col" className="pb-2 font-bold">Nivel</th>
                      <th scope="col" className="pb-2 text-right font-bold">Precio</th>
                      <th scope="col" className="pb-2 text-right font-bold">Distancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((level) => {
                      const isNearest = position.resistance?.key === level.key || position.support?.key === level.key
                      return (
                        <tr key={level.key} className={clsx('border-t border-hairline-soft', isNearest && 'bg-surface-2/70')}>
                          <th scope="row" className={clsx('py-2 pl-1 text-xs font-bold', KIND_TEXT[level.kind])}>
                            {level.label}
                          </th>
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => copy(formatLevel(level.value, price, symbol).replace(/,/g, ''), level.key)}
                              title="Copiar valor"
                              className="rounded px-1.5 py-0.5 font-mono text-sm tabular-nums text-ink transition-colors hover:bg-surface-2"
                            >
                              {copied === level.key ? 'Copiado' : formatLevel(level.value, price, symbol)}
                            </button>
                          </td>
                          <td className="py-2 pr-1 text-right font-mono text-xs tabular-nums text-ink-muted">{signed(distancePct(level.value, price))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <p className="mt-3 border-t border-hairline-soft pt-3 text-micro text-ink-muted">
                  Precio en <span className="font-mono font-bold text-ink">{formatLevel(price, price, symbol)}</span> ·{' '}
                  <span className="font-bold text-ink">{position.zone}</span>
                  {position.bias !== 'neutral' && (
                    <span className={position.bias === 'bullish' ? 'text-semantic-success' : 'text-semantic-danger'}>
                      {' '}
                      · sesgo {position.bias === 'bullish' ? 'alcista' : 'bajista'}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-outline-variant/40 bg-surface-2/30 p-4" aria-labelledby="calc-confluence-heading">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="calc-confluence-heading" className="text-micro font-bold uppercase tracking-wider text-ink-muted">
                    Zonas de confluencia
                  </h3>
                  <label className="flex items-center gap-2 text-micro text-ink-subtle">
                    Tolerancia
                    <select
                      value={tolerance}
                      onChange={(event) => setTolerance(Number(event.target.value))}
                      className="rounded-lg border border-outline-variant/40 bg-surface-2 px-2 py-1 text-micro text-ink focus:border-accent-blue focus:outline-none"
                    >
                      {TOLERANCES.map((value) => (
                        <option key={value} value={value}>
                          ±{value}%
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {confluences.length === 0 ? (
                  <p className="text-body-sm text-ink-muted">Ningún nivel de distintos métodos coincide con esta tolerancia.</p>
                ) : (
                  <ul className="space-y-2">
                    {confluences.map((confluence) => (
                      <li key={confluence.value} className="flex items-center justify-between gap-3 rounded-lg border border-hairline-soft bg-surface-container-lowest px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-bold tabular-nums text-ink">{formatLevel(confluence.value, price, symbol)}</p>
                          <p className="truncate text-[11px] text-ink-muted">
                            {confluence.levels.map((level) => `${PIVOT_METHOD_INFO[level.method].short} ${level.label}`).join(' · ')}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">{signed(distancePct(confluence.value, price))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="min-w-0 rounded-xl border border-outline-variant/40 bg-surface-2/30 p-4" aria-labelledby="calc-matrix-heading">
                <h3 id="calc-matrix-heading" className="mb-3 text-micro font-bold uppercase tracking-wider text-ink-muted">
                  Comparación de métodos
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[26rem] text-right">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-ink-subtle">
                        <th scope="col" className="pb-2 text-left font-bold">Nivel</th>
                        {PIVOT_METHODS.map((option) => (
                          <th key={option} scope="col" className={clsx('pb-2 pl-2 font-bold', option === method && 'text-accent-blue')}>
                            {PIVOT_METHOD_INFO[option].short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MATRIX_ROWS.map(([key, label]) => (
                        <tr key={key} className="border-t border-hairline-soft">
                          <th scope="row" className="py-1.5 text-left text-[11px] font-bold text-ink-muted">{label}</th>
                          {PIVOT_METHODS.map((option) => {
                            const value = (result[option] as Record<string, number>)[key]
                            const inConfluence = value !== undefined && confluentCells.has(`${option}:${label}`)
                            return (
                              <td
                                key={option}
                                className={clsx(
                                  'py-1.5 pl-2 font-mono text-[11px] tabular-nums',
                                  value === undefined ? 'text-ink-subtle' : 'text-ink',
                                  option === method && 'bg-accent-blue/5'
                                )}
                              >
                                {value === undefined ? '—' : formatLevel(value, price, symbol)}
                                {inConfluence && <span className="ml-1 text-accent-blue" title="Confluencia con otro método" aria-label="en confluencia">●</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-ink-subtle">
                  <span className="text-accent-blue">●</span> Nivel que coincide con otro método dentro de la tolerancia.
                </p>
              </section>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-outline-variant/40 px-6 py-14 text-center">
            <span className="material-symbols-outlined mb-3 block text-5xl text-ink-subtle" aria-hidden="true">
              candlestick_chart
            </span>
            <p className="mb-1 text-body text-ink-muted">
              {hasAnyValue ? 'Corrige los campos marcados para ver los niveles' : 'Elige un activo o escribe los datos del período anterior'}
            </p>
            <p className="text-micro text-ink-subtle">Hacen falta el máximo, el mínimo y el cierre.</p>
          </div>
        )}
      </div>
    </div>
  )
}
