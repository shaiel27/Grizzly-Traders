import type { Metadata } from 'next'
import { getMarkets } from '@/lib/markets'
import { MarketsClient } from './MarketsClient'

export const metadata: Metadata = {
  title: 'Terminal de mercados',
  description:
    'Cotizaciones, mapa de calor e indicadores técnicos (RSI, MACD, medias móviles, pivotes) de criptomonedas, forex, acciones, índices y materias primas, con gráficos.',
  alternates: { canonical: '/markets' },
}

// The market data is cached for a minute; the client keeps the table fresh afterwards.
// ?activo=<ticker> preselects an asset so a link can point at a specific chart.
export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ activo?: string }> }) {
  const [assets, { activo }] = await Promise.all([getMarkets().catch(() => []), searchParams])
  return <MarketsClient initialAssets={assets} initialSymbol={activo ?? null} />
}
