'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'

import { AssetTable } from '@/components/ui/AssetTable'
import { AssetDetailPanel } from '@/components/ui/AssetDetailPanel'
import { TopMovers } from '@/components/ui/TopMovers'
import { FearGreedGauge } from '@/components/ui/FearGreedGauge'
import type { MarketItem as MarketAsset } from '@/lib/markets'

// lightweight-charts touches the DOM, so it is loaded on the client only and kept out of the initial bundle
const MarketChart = dynamic(() => import('@/components/ui/MarketChart').then((mod) => mod.MarketChart), {
  ssr: false,
  loading: () => <div className="h-[430px] animate-pulse rounded-2xl bg-surface-2" aria-hidden="true" />,
})

export function MarketsClient({ initialAssets }: { initialAssets: MarketAsset[] }) {
  const [assets, setAssets] = useState<MarketAsset[]>(initialAssets)
  const [selectedAsset, setSelectedAsset] = useState<MarketAsset | null>(initialAssets[0] ?? null)
  const [loading, setLoading] = useState(initialAssets.length === 0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchAssets() {
      if (document.hidden) return
      try {
        const response = await fetch('/api/markets')
        const result = await response.json()
        if (result.success && result.data) {
          const fresh: MarketAsset[] = result.data
          setAssets(fresh)
          setLastUpdate(new Date())
          setError(false)
          setSelectedAsset((prev) => fresh.find((a) => a.symbol === prev?.symbol) ?? fresh[0] ?? null)
        } else {
          setError(true)
        }
      } catch (error) {
        console.error('Failed to fetch assets:', error)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    // The server already rendered the table, so only fetch right away when it came empty
    if (initialAssets.length === 0) fetchAssets()
    const interval = setInterval(fetchAssets, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialAssets only decides the first fetch
  }, [])

  const chartLevels = useMemo(
    () =>
      selectedAsset
        ? [
            { price: selectedAsset.sma50, title: 'SMA 50', color: '#f59e0b' },
            { price: selectedAsset.sma200, title: 'SMA 200', color: '#a78bfa' },
          ]
        : [],
    [selectedAsset]
  )

  return (
    <>

      <main id="main-content" tabIndex={-1} className="flex-1 pt-[104px] pb-24">
        <div className="max-w-[1400px] mx-auto px-6 pt-8 md:px-8">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-display-lg-mobile sm:text-display-lg font-bold text-ink mb-2">Terminal de Mercados</h1>
              <p className="text-body text-on-surface-variant">
                {assets.length} activos · Datos de TradingView con indicadores técnicos en tiempo real.
              </p>
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-2 text-micro text-ink-muted">
                <span className="size-2 rounded-full bg-semantic-success animate-pulse" />
                Actualizado: {lastUpdate.toLocaleTimeString('es-AR')}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="mb-6 rounded-xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-body-sm text-ink">
              No se pudieron actualizar los datos de mercado. Se reintentará automáticamente.
            </p>
          )}

          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
            <FearGreedGauge />
            <TopMovers assets={assets} onSelect={setSelectedAsset} />
          </div>

          {/* Chart + Detail Panel */}
          {selectedAsset && (
            <div className="mb-8 space-y-6">
              <MarketChart symbol={selectedAsset.symbol} name={selectedAsset.name} levels={chartLevels} />
              <AssetDetailPanel asset={selectedAsset} />
            </div>
          )}

          {/* Asset Table */}
          <AssetTable
            assets={assets}
            loading={loading}
            onSelectAsset={setSelectedAsset}
          />
        </div>
      </main>

    </>
  )
}
