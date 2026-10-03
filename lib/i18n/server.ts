import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, hasLocale, type Locale } from './get-dictionary'
import { LOCALE_COOKIE } from './constants'

// Server-only: reads the `gt_locale` cookie for the current request. Used by app/layout.tsx
// (for <html lang>) and app/(site)/layout.tsx (to seed LocaleProvider and fetch the dictionary).
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return hasLocale(value) ? value : DEFAULT_LOCALE
}
