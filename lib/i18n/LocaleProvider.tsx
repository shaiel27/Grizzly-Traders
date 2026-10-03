'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary, Locale } from './get-dictionary'
import { LOCALE_COOKIE, LOCALE_MAX_AGE } from './constants'

interface LocaleContextValue {
  locale: Locale
  dictionary: Dictionary
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

interface LocaleProviderProps {
  locale: Locale
  dictionary: Dictionary
  children: ReactNode
}

// Mounted once in app/(site)/layout.tsx. Deliberately holds no local React state: `locale`/`dictionary`
// always come straight from the server (cookie -> getServerLocale() -> getDictionary()) as props, so
// setLocale only has to write the cookie and ask the server for a fresh render — router.refresh()
// re-runs the layout, which re-reads the cookie and feeds this provider the new value on the next render.
export function LocaleProvider({ locale, dictionary, children }: LocaleProviderProps) {
  const router = useRouter()

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_MAX_AGE}; samesite=lax`
      router.refresh()
    },
    [locale, router]
  )

  const value = useMemo<LocaleContextValue>(() => ({ locale, dictionary, setLocale }), [locale, dictionary, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}

export function useDictionary(): Dictionary {
  return useLocale().dictionary
}
