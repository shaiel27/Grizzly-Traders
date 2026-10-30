'use client'

// Alertas de precio del terminal (C8): client-side puro, sin backend. La mitad de arriba es
// lógica pura y está cubierta por lib/price-alerts.test.ts; la mitad de abajo es el store de
// localStorage, con el mismo patrón (useSyncExternalStore sobre el string crudo) que lib/watchlist.ts
// y lib/columns.ts — el snapshot crudo hace que React compare por valor y la hidratación SSR
// nunca lea localStorage.
import { useCallback, useMemo, useSyncExternalStore } from 'react'

export interface PriceAlert {
  id: string
  symbol: string
  above: boolean
  price: number
  createdAt: number
}

export const STORAGE_KEY = 'gt:alerts:v1'
// Tope defensivo: una lista infinita es inutilizable en el panel y un vector de crecimiento
// ilimitado en el storage (50 cubre cualquier uso real de una sesión)
export const MAX_ALERTS = 50

const EMPTY = '[]'
const listeners = new Set<() => void>()

function isValidAlert(value: unknown): value is PriceAlert {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PriceAlert>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.symbol === 'string' &&
    candidate.symbol.length > 0 &&
    typeof candidate.above === 'boolean' &&
    typeof candidate.price === 'number' &&
    Number.isFinite(candidate.price) &&
    candidate.price > 0 &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt)
  )
}

// Lo que hay en localStorage puede venir roto (otra versión, las DevTools, un JSON a medias),
// así que nunca se consume en crudo: corrupto → [], inválidos fuera, y el resultado nunca
// supera MAX_ALERTS (gana el más reciente por createdAt, en orden ascendente).
export function parseStoredAlerts(raw: unknown): PriceAlert[] {
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return capAlerts(value.filter(isValidAlert))
}

// Único sitio donde se aplica el tope, para que parse y upsert no se contradigan: por encima de
// MAX_ALERTS sobrevive el más reciente por createdAt y el orden vuelve a ser ascendente.
function capAlerts(alerts: PriceAlert[]): PriceAlert[] {
  if (alerts.length <= MAX_ALERTS) return alerts
  return [...alerts].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ALERTS).sort((a, b) => a.createdAt - b.createdAt)
}

// Quita las alertas disparadas por id: inmutable (filter devuelve array nuevo) e ignora ids que
// no estén en la lista, para que un disparo repetido no pueda romper nada.
export function removeFired(alerts: PriceAlert[], fired: readonly PriceAlert[]): PriceAlert[] {
  if (fired.length === 0) return alerts
  const ids = new Set(fired.map((candidate) => candidate.id))
  return alerts.filter((candidate) => !ids.has(candidate.id))
}

// Alta y edición en un paso: id existente → se reemplaza en su sitio; id nuevo → se añade al
// final. El tope se aplica después, así que la lista nunca supera MAX_ALERTS.
export function upsert(alerts: PriceAlert[], candidate: PriceAlert): PriceAlert[] {
  const exists = alerts.some((stored) => stored.id === candidate.id)
  const next = exists ? alerts.map((stored) => (stored.id === candidate.id ? candidate : stored)) : [...alerts, candidate]
  return capAlerts(next)
}

// Devuelve las alertas cuyo umbral ya se cruzó con el quote de su símbolo: `above` dispara con
// close ≥ price, `below` con close ≤ price (la igualdad cuenta: el precio tocó el nivel). Los
// símbolos sin quote en el lote no se tocan — en v1 el lote es solo el activo seleccionado.
export function evaluateAlerts(alerts: PriceAlert[], quotes: Record<string, number>): PriceAlert[] {
  return alerts.filter((candidate) => {
    const close = quotes[candidate.symbol]
    if (typeof close !== 'number' || !Number.isFinite(close)) return false
    return candidate.above ? close >= candidate.price : close <= candidate.price
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY
  } catch {
    return EMPTY
  }
}

function getServerSnapshot() {
  return EMPTY
}

function parse(raw: string): PriceAlert[] {
  return parseStoredAlerts(raw)
}

function persist(next: PriceAlert[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable (private mode): nothing to persist
  }
  listeners.forEach((listener) => listener())
}

// Mismo contrato que useWatchlist: el snapshot crudo vive en useSyncExternalStore (y el
// server snapshot fijo evita el mismatch de hidratación) y la lista parseada se deriva de él.
export function usePriceAlerts() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const alerts = useMemo(() => parse(raw), [raw])

  const upsertAlert = useCallback((candidate: PriceAlert) => {
    persist(upsert(parse(getSnapshot()), candidate))
  }, [])

  const removeAlerts = useCallback((fired: readonly PriceAlert[]) => {
    const current = parse(getSnapshot())
    const next = removeFired(current, fired)
    // Solo se escribe si algo cambió: un disparo repetido no debe notificar a los listeners
    if (next.length !== current.length) persist(next)
  }, [])

  return { alerts, upsert: upsertAlert, remove: removeAlerts }
}
