import type { Metadata } from 'next'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getRouteLocale } from '@/lib/i18n/route-locale'
import { getPivotQuotes } from '@/lib/pivot-data'
import { PivotPointsClient } from './PivotPointsClient'

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getRouteLocale())
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
