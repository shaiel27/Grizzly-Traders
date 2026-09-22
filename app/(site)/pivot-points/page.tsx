import type { Metadata } from 'next'
import { getPivotQuotes } from '@/lib/pivot-data'
import { PivotPointsClient } from './PivotPointsClient'

export const metadata: Metadata = {
  title: 'Pivot Points',
  description:
    'Soportes y resistencias diarios, semanales y mensuales (Clásico, Fibonacci, Camarilla, Woodie y DeMark) para cripto, forex, materias primas, índices y acciones, con calculadora de pivotes.',
  alternates: { canonical: '/pivot-points' },
}

export default async function PivotPointsPage() {
  const quotes = await getPivotQuotes('D').catch(() => [])
  return <PivotPointsClient initialQuotes={quotes} />
}
