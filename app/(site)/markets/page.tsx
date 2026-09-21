import type { Metadata } from 'next'
import { getMarkets } from '@/lib/markets'
import { MarketsClient } from './MarketsClient'

export const metadata: Metadata = {
  title: 'Terminal de mercados',
  description:
    'Cotizaciones e indicadores técnicos (RSI, MACD, medias móviles) de criptomonedas, forex, acciones, índices y materias primas, con gráficos.',
  alternates: { canonical: '/markets' },
}

// Cached for a minute; the client keeps the table fresh afterwards
export default async function MarketsPage() {
  const assets = await getMarkets().catch(() => [])
  return <MarketsClient initialAssets={assets} />
}
