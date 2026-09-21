import { Header, Footer } from '@/components/ui'
import { getCategories } from '@/lib/api'
import { getCachedPrices } from '@/lib/prices'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Independent lookups run together; a failing provider must never break the page
  const [categories, prices] = await Promise.all([
    getCategories()
      .then((list) => list.map(({ id, name, slug }) => ({ id, name, slug })))
      .catch(() => []),
    getCachedPrices().catch(() => []),
  ])

  return (
    <>
      <Header categories={categories} initialPrices={prices} />
      {children}
      <Footer categories={categories} />
    </>
  )
}
