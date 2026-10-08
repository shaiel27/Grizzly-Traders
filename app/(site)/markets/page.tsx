import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getServerLocale } from '@/lib/i18n/server'
import { getMarkets } from '@/lib/markets'
import { MarketsClient } from './MarketsClient'

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getServerLocale())
  return {
    title: dict.markets.pageTitle,
    description: dict.markets.metaDescription,
    alternates: { canonical: '/markets' },
  }
}

// The market data is cached for a minute; the client keeps the table fresh afterwards.
// ?activo=<ticker> preselects an asset so a link can point at a specific chart.
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ activo?: string }> }) {
  const [assets, { activo }] = await Promise.all([getMarkets().catch(() => []), searchParams])
  return <MarketsClient initialAssets={assets} initialSymbol={activo ?? null} />
}
