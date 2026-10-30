'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { clsx } from 'clsx'

import { formatPrice } from '@/lib/format'
import { t, type Dictionary } from '@/lib/i18n/get-dictionary'
import { evaluateAlerts, usePriceAlerts, type PriceAlert } from '@/lib/price-alerts'

// Avisos en pantalla: suficientes para un disparo simultáneo de varias alertas del mismo
// símbolo, sin convertir el panel en un feed
const MAX_NOTICES = 3

// El panel existe solo en el cliente, así que el id puede pedirse a crypto.randomUUID (contexto
// seguro en localhost/https); el fallback cubre navegadores viejos o contextos no seguros
function makeAlertId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

interface PriceAlertsProps {
  // Activo seleccionado en la terminal: las alertas se crean sobre él y su close es el único
  // quote que evalúa la v1 (MarketsClient ya lo sondea, sin fetch nuevo por alerta)
  symbol: string | null
  close: number | null
  dict: Dictionary['priceAlerts']
}

export function PriceAlerts({ symbol, close, dict }: PriceAlertsProps) {
  const { alerts, upsert, remove } = usePriceAlerts()
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(true)
  // El precio escrito se recuerda junto al símbolo al que pertenece: al cambiar de activo el
  // edit deja de coincidir y el campo vuelve solo al close en vivo, sin ningún efecto que
  // reescriba estado (y un quote nuevo nunca pisa lo que se está escribiendo)
  const [priceEdit, setPriceEdit] = useState<{ symbol: string; value: string } | null>(null)
  // Último envío inválido, anclado al par símbolo/valor al que pertenece: el error se deriva,
  // así que desaparece solo al corregir el precio o al cambiar de activo
  const [invalidSubmit, setInvalidSubmit] = useState<{ symbol: string; value: string } | null>(null)
  const [notices, setNotices] = useState<PriceAlert[]>([])
  // Guarda de disparo único: el id de una alerta ya disparada no vuelve a avisar aunque el
  // efecto se reejecute (StrictMode) antes de que el store se repinte
  const handledRef = useRef<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const directionName = useId()
  const priceInputId = useId()
  const priceErrorId = useId()

  const priceValue = priceEdit && priceEdit.symbol === symbol ? priceEdit.value : close != null ? String(close) : ''
  const priceError = invalidSubmit !== null && invalidSubmit.symbol === symbol && invalidSubmit.value === priceValue

  // Disparo: el close del activo seleccionado llega por props desde el sondeo que MarketsClient
  // ya hace. Al cruzar el umbral la alerta sale de la lista (una sola vez, aunque cada poll
  // siga trayendo el mismo close) y se avisa por Notification cuando hay permiso; el aviso
  // inline de role="status" dentro del panel es el respaldo cuando lo hay (o no se pidió).
  useEffect(() => {
    if (!symbol || close == null || alerts.length === 0) return
    const fired = evaluateAlerts(alerts, { [symbol]: close }).filter((candidate) => !handledRef.current.has(candidate.id))
    if (fired.length === 0) return
    fired.forEach((candidate) => handledRef.current.add(candidate.id))
    remove(fired)
    setNotices((previous) => [...fired, ...previous].slice(0, MAX_NOTICES))
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    for (const candidate of fired) {
      try {
        new Notification(dict.title, {
          body: t(dict.firedNotice, { symbol: candidate.symbol, price: formatPrice(candidate.price, candidate.symbol) }),
        })
      } catch {
        // Plataformas que exigen service worker (o notificaciones bloqueadas): el aviso inline
        // de arriba ya está montado, el permiso nunca es lo único que sostiene el aviso
      }
    }
  }, [symbol, close, alerts, remove, dict])

  // Teclado y clic fuera solo mientras el panel está abierto; Escape devuelve el foco al botón.
  // La entrada del panel es la clase .menu-item-in de globals.css (la misma del menú móvil):
  // monta/desmonta con el panel, sin estado intermedio que reescribir en el efecto.
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  function closePanel() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const price = Number(priceValue)
    if (!symbol || !Number.isFinite(price) || price <= 0) {
      setInvalidSubmit({ symbol: symbol ?? '', value: priceValue })
      return
    }
    // El permiso se pide solo al crear la primera alerta; si el navegador no lo soporta o el
    // usuario lo deniega, el aviso inline sigue cubriendo el disparo
    if (alerts.length === 0 && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        void Notification.requestPermission()
      } catch {
        // Sin API de permisos: solo aviso inline
      }
    }
    upsert({ id: makeAlertId(), symbol, above, price, createdAt: Date.now() })
    setPriceEdit(null)
    setInvalidSubmit(null)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-ctl border border-hairline-soft bg-surface-1 px-2.5 py-1 text-[13px] text-ink transition-[color,background-color,border-color,transform] duration-150 hover:border-hairline focus-visible:outline-2 focus-visible:outline-accent-blue active:scale-[0.97]"
      >
        {/* notifications (campana) no está en el subset de iconos: schedule = "esperando un
            disparo", star ya es la lista de favoritos y add solo cubriría la creación */}
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          schedule
        </span>
        {dict.openButton}
        {alerts.length > 0 && (
          <>
            <span
              aria-hidden="true"
              className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-blue/15 px-1 text-[10px] font-semibold text-accent-blue"
            >
              {alerts.length}
            </span>
            <span className="sr-only">{t(dict.countLabel, { n: alerts.length })}</span>
          </>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label={dict.title}
          className="menu-item-in absolute right-0 top-full z-40 mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-sm border border-hairline bg-surface-container-low p-3 shadow-xl outline-none"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-ink">{dict.title}</p>
            <button
              type="button"
              aria-label={dict.closeAria}
              onClick={closePanel}
              className="grid size-6 place-items-center rounded-xs text-ink-muted transition-[color,background-color,transform] duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          {/* Región viva siempre montada dentro del panel: el contenido entra después del
              render, que es lo que un lector de pantalla necesita para anunciarlo */}
          <div role="status" aria-live="polite" className={notices.length > 0 ? 'mb-3' : undefined}>
            {notices.length > 0 && (
              <div className="flex items-start gap-2 rounded-ctl border border-accent-blue/30 bg-accent-blue/10 px-2.5 py-2">
                <ul className="min-w-0 flex-1 space-y-0.5">
                  {notices.map((notice) => (
                    <li key={notice.id} className="text-[12px] text-ink">
                      {t(dict.firedNotice, { symbol: notice.symbol, price: formatPrice(notice.price, notice.symbol) })}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  aria-label={dict.dismissAria}
                  onClick={() => setNotices([])}
                  className="grid size-5 shrink-0 place-items-center rounded-xs text-accent-blue transition-[color,background-color,transform] duration-150 hover:bg-accent-blue/15 focus-visible:outline-2 focus-visible:outline-accent-blue active:scale-[0.95]"
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
            )}
          </div>

          <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{dict.listHeading}</p>
          {alerts.length === 0 ? (
            <p className="px-1 py-3 text-center text-[13px] text-ink-muted">{dict.empty}</p>
          ) : (
            <ul className="max-h-[220px] space-y-0.5 overflow-y-auto">
              {alerts.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-2 rounded-ctl px-1.5 py-1.5">
                  <span className="text-[13px] font-semibold text-ink">{candidate.symbol}</span>
                  <span className="text-[12px] text-ink-muted">{candidate.above ? dict.above : dict.below}</span>
                  <span className="ml-auto tabular-nums text-[13px] text-ink">{formatPrice(candidate.price, candidate.symbol)}</span>
                  <button
                    type="button"
                    aria-label={t(dict.deleteAria, { symbol: candidate.symbol })}
                    onClick={() => remove([candidate])}
                    className="grid size-6 shrink-0 place-items-center rounded-xs text-ink-muted transition-[color,background-color,transform] duration-150 hover:bg-surface-2 hover:text-semantic-danger focus-visible:outline-2 focus-visible:outline-accent-blue active:scale-[0.97]"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {symbol && (
            <form onSubmit={onCreate} className="mt-3 border-t border-hairline-soft pt-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{dict.formHeading}</p>
              <fieldset className="mb-2.5">
                <legend className="mb-1 px-1 text-[12px] text-ink-muted">{dict.directionLabel}</legend>
                <div className="flex gap-1 rounded-ctl border border-hairline-soft bg-surface-1 p-1">
                  {(['above', 'below'] as const).map((direction) => {
                    const active = above === (direction === 'above')
                    return (
                      <label key={direction} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name={directionName}
                          value={direction}
                          checked={active}
                          onChange={() => setAbove(direction === 'above')}
                          className="peer sr-only"
                        />
                        <span
                          className={clsx(
                            'block rounded-xs px-2 py-1 text-center text-[12px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-accent-blue',
                            active ? 'bg-surface-container-lowest font-semibold text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                          )}
                        >
                          {direction === 'above' ? dict.above : dict.below}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <label htmlFor={priceInputId} className="mb-1 block px-1 text-[12px] text-ink-muted">
                {dict.priceLabel}
              </label>
              <input
                id={priceInputId}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={priceValue}
                onChange={(event) => setPriceEdit({ symbol: symbol ?? '', value: event.target.value })}
                aria-invalid={priceError || undefined}
                aria-describedby={priceError ? priceErrorId : undefined}
                className="w-full rounded-ctl border border-hairline-soft bg-surface-1 px-2.5 py-1.5 text-[13px] tabular-nums text-ink transition-colors hover:border-hairline focus-visible:outline-2 focus-visible:outline-accent-blue"
              />
              {priceError && (
                <p id={priceErrorId} role="alert" className="mt-1 px-1 text-[12px] text-semantic-danger">
                  {dict.errorPrice}
                </p>
              )}

              <button
                type="submit"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-ctl bg-accent-blue px-3 py-2 text-[13px] font-semibold text-canvas transition-[color,background-color,transform] duration-150 hover:bg-accent-blue-hover focus-visible:outline-2 focus-visible:outline-accent-blue active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  add
                </span>
                {dict.create}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
