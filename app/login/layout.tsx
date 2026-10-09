import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'

// /login sits outside the (site) route group (no Header/Footer chrome), so it never inherited
// (site)/layout.tsx's LocaleProvider — useDictionary()/useLocale() crashed at runtime without this.
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale()
  const dictionary = getDictionary(locale)

  return (
    <LocaleProvider locale={locale} dictionary={dictionary}>
      {children}
    </LocaleProvider>
  )
}
