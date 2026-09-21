import type { Metadata } from 'next'
import { getDefaultPivots } from '@/lib/pivot-data'
import { PivotPointsClient } from './PivotPointsClient'

export const metadata: Metadata = {
  title: 'Pivot Points diarios',
  description:
    'Niveles de soporte y resistencia (Clásico, Fibonacci, Camarilla, Woodie y DeMark) para los principales activos, y calculadora de pivotes.',
  alternates: { canonical: '/pivot-points' },
}

export default async function PivotPointsPage() {
  const pivots = await getDefaultPivots().catch(() => [])
  return <PivotPointsClient initialPivots={pivots} />
}
