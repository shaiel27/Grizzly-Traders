import { Header, Footer } from '@/components/ui'
import { getCategories } from '@/lib/api'
import { getTickerSnapshot } from '@/lib/ticker'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Independent lookups run together; a failing provider must never break the page
  const [categories, ticker] = await Promise.all([
    getCategories()
      .then((list) => list.map(({ id, name, slug }) => ({ id, name, slug })))
      .catch(() => []),
    getTickerSnapshot().catch(() => null),
  ])

  return (
    <>
      <Header categories={categories} initialTicker={ticker} />
      {children}
      <Footer categories={categories} />
    </>
  )
}
