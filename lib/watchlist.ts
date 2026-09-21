'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'gt:watchlist'
const EMPTY = '[]'
const listeners = new Set<() => void>()

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

function parse(raw: string): string[] {
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

// Favorites live in localStorage (per browser). The raw string is the snapshot so React compares by value.
export function useWatchlist() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY)
  const symbols = useMemo(() => parse(raw), [raw])

  const toggle = useCallback((symbol: string) => {
    const current = parse(getSnapshot())
    const next = current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol]
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // storage unavailable (private mode): nothing to persist
    }
    listeners.forEach((listener) => listener())
  }, [])

  return { symbols, toggle, has: (symbol: string) => symbols.includes(symbol) }
}
