import { Header, Footer } from '@/components/ui'
import { getCategories } from '@/lib/api'
import { getTickerSnapshot } from '@/lib/ticker'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Independent lookups run together; a failing provider must never break the page
  const [categories, ticker, locale] = await Promise.all([
    getCategories()
      .then((list) => list.map(({ id, name, slug }) => ({ id, name, slug })))
      .catch(() => []),
    getTickerSnapshot().catch(() => null),
    getServerLocale(),
  ])
  const dictionary = getDictionary(locale)

  return (
    // Header is a client component and consumes {locale, dictionary} via useLocale()/useDictionary().
    // Footer is a server component (no hooks), so it gets them as explicit props below; its embedded
    // <LocaleSwitcher> still works because it's a client component slotted into this same provider tree.
    <LocaleProvider locale={locale} dictionary={dictionary}>
      <Header categories={categories} initialTicker={ticker} />
      {children}
      <Footer categories={categories} locale={locale} dictionary={dictionary} />
    </LocaleProvider>
  )
}
