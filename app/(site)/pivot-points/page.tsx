import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getServerLocale } from '@/lib/i18n/server'
import { getPivotQuotes } from '@/lib/pivot-data'
import { PivotPointsClient } from './PivotPointsClient'

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getServerLocale())
  return {
    title: dict.pivotPoints.pageTitle,
    description: dict.pivotPoints.metaDescription,
    alternates: { canonical: '/pivot-points' },
  }
}

export default async function PivotPointsPage() {
  const quotes = await getPivotQuotes('D').catch(() => [])
  return <PivotPointsClient initialQuotes={quotes} />
}
