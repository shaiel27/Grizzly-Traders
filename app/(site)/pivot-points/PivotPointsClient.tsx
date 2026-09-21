'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { formatPrice as formatMarketPrice } from '@/lib/format'

import { PivotCalculator } from '@/components/ui/PivotCalculator'
import { PivotLevelsChart } from '@/components/ui/PivotLevelsChart'

interface PivotData {
  symbol: string
  description: string
  close: number
  open: number
  high: number
  low: number
  change: number
  changeAbs: number
  volume: number
  classic: { pivot: number; s1: number; s2: number; s3: number; r1: number; r2: number; r3: number }
  fibonacci: { s1: number; r1: number }
  camarilla: { s1: number; r1: number }
  woodie: { s1: number; r1: number }
  demark: { s1: number; r1: number }
}

const ASSET_CATEGORIES = [
  { key: 'all', label: 'Todos' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'forex', label: 'Forex' },
  { key: 'commodity', label: 'Materias Primas' },
  { key: 'stock', label: 'Acciones' },
  { key: 'index', label: 'Índices' },
]

const CATEGORY_MAP: Record<string, string> = {
  'BINANCE:BTCUSDT': 'crypto', 'BINANCE:ETHUSDT': 'crypto', 'BINANCE:SOLUSDT': 'crypto',
  'FX:EURUSD': 'forex', 'FX:GBPUSD': 'forex',
  'COMEX:XAUUSD': 'commodity', 'COMEX:XAGUSD': 'commodity',
  'NASDAQ:AAPL': 'stock', 'NASDAQ:NVDA': 'stock',
  'SP:SPX': 'index', 'TVC:DXY': 'index',
}

const SYMBOL_NAMES: Record<string, string> = {
  'BINANCE:BTCUSDT': 'Bitcoin', 'BINANCE:ETHUSDT': 'Ethereum', 'BINANCE:SOLUSDT': 'Solana',
  'FX:EURUSD': 'Euro/Dólar', 'FX:GBPUSD': 'Libra/Dólar',
  'COMEX:XAUUSD': 'Oro', 'COMEX:XAGUSD': 'Plata',
  'NASDAQ:AAPL': 'Apple', 'NASDAQ:NVDA': 'Nvidia',
  'SP:SPX': 'S&P 500', 'TVC:DXY': 'Dollar Index',
}

type Method = 'classic' | 'fibonacci' | 'camarilla' | 'woodie' | 'demark'

export function PivotPointsClient({ initialPivots }: { initialPivots: PivotData[] }) {
  const [pivots, setPivots] = useState<PivotData[]>(initialPivots)
  const [loading, setLoading] = useState(initialPivots.length === 0)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedAsset, setSelectedAsset] = useState<PivotData | null>(initialPivots[0] ?? null)
  const [selectedMethod, setSelectedMethod] = useState<Method>('classic')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPivots() {
      if (document.hidden) return
      try {
        const response = await fetch('/api/pivots')
        const result = await response.json()
        if (result.success && result.data) {
          const fresh: PivotData[] = result.data
          setPivots(fresh)
          setSelectedAsset((prev) => fresh.find((p) => p.symbol === prev?.symbol) ?? fresh[0] ?? null)
          setLastUpdate(new Date())
          setError(false)
        } else {
          setError(true)
        }
      } catch (error) {
        console.error('Failed to fetch pivots:', error)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    // The server already rendered the table, so only fetch right away when it came empty
    if (initialPivots.length === 0) fetchPivots()
    const interval = setInterval(fetchPivots, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialPivots only decides the first fetch
  }, [])

  const filteredPivots = selectedCategory === 'all'
    ? pivots
    : pivots.filter((p) => CATEGORY_MAP[p.symbol] === selectedCategory)

  const formatPrice = (v: number | null | undefined, sym: string) =>
    formatMarketPrice(v, sym, { currency: true, forexDecimals: 4 })

  return (
    <>

      <main id="main-content" tabIndex={-1} className="flex-1 pt-[104px] pb-24">
        <div className="section-container max-w-[1400px] mx-auto pt-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-[28px] text-accent-blue" aria-hidden="true">candlestick_chart</span>
              <h1 className="text-display-lg-mobile sm:text-display-lg font-bold text-ink">Pivot Points Diarios</h1>
            </div>
            <p className="text-body text-on-surface-variant max-w-3xl">
              Niveles de soporte y resistencia calculados con 5 métodos distintos. Datos en tiempo real proporcionados por TradingView Scanner API.
            </p>
            {lastUpdate && (
              <p className="text-micro text-ink-subtle mt-2">
                Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="mb-6 rounded-xl border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-body-sm text-ink">
              No se pudieron actualizar los pivotes. Se reintentará automáticamente.
            </p>
          )}

          {loading ? (
            <div className="space-y-6">
              <div className="h-12 bg-surface-2 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-48 bg-surface-2 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Categorías">
                {ASSET_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    aria-pressed={selectedCategory === cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={clsx(
                      'px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all',
                      selectedCategory === cat.key
                        ? 'bg-accent-blue text-white border-accent-blue'
                        : 'bg-transparent text-ink-muted border-outline-variant/40 hover:border-outline-variant hover:text-ink'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Main Content: Table + Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                {/* Pivot Table */}
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
                    <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between">
                      <h2 className="text-subhead font-bold text-ink">Niveles por Activo</h2>
                      <div className="flex gap-1 p-0.5 rounded-lg bg-surface-2">
                        {(['classic', 'fibonacci', 'camarilla', 'woodie', 'demark'] as Method[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={selectedMethod === m}
                            onClick={() => setSelectedMethod(m)}
                            className={clsx(
                              'px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all',
                              selectedMethod === m
                                ? 'bg-surface-container-lowest text-ink shadow-sm'
                                : 'text-ink-muted hover:text-ink'
                            )}
                          >
                            {m === 'classic' ? 'Clásico' : m === 'fibonacci' ? 'Fib' : m === 'camarilla' ? 'Cam' : m === 'woodie' ? 'Wood' : 'DM'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-outline-variant/40">
                            <th scope="col" className="px-4 py-3 text-left text-micro font-bold text-ink-muted uppercase tracking-wider">Activo</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-ink-muted uppercase tracking-wider">Precio</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-semantic-danger uppercase tracking-wider">S3</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-semantic-danger uppercase tracking-wider">S2</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-semantic-danger uppercase tracking-wider">S1</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-accent-blue uppercase tracking-wider">PP</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-semantic-success uppercase tracking-wider">R1</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-semantic-success uppercase tracking-wider">R2</th>
                            <th scope="col" className="px-4 py-3 text-right text-micro font-bold text-semantic-success uppercase tracking-wider">R3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPivots.map((p) => {
                            const isSelected = selectedAsset?.symbol === p.symbol
                            const isAbovePivot = p.close >= p.classic.pivot
                            return (
                              <tr
                                key={p.symbol}
                                onClick={() => setSelectedAsset(p)}
                                className={clsx(
                                  'border-b border-outline-variant/20 cursor-pointer transition-colors',
                                  isSelected ? 'bg-accent-blue/5' : 'hover:bg-surface-2/50'
                                )}
                              >
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      setSelectedAsset(p)
                                    }}
                                    aria-pressed={isSelected}
                                    className="text-left"
                                  >
                                    <span className="block text-sm font-bold text-ink">{SYMBOL_NAMES[p.symbol] ?? p.symbol}</span>
                                    <span className="block text-micro text-ink-muted">{p.symbol}</span>
                                  </button>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={clsx('text-sm font-bold font-mono tabular-nums', isAbovePivot ? 'text-semantic-success' : 'text-semantic-danger')}>
                                    {formatPrice(p.close, p.symbol)}
                                  </span>
                                </td>
                                {selectedMethod === 'classic' ? (
                                  <>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-danger">{formatPrice(p.classic.s3, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-danger">{formatPrice(p.classic.s2, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-danger">{formatPrice(p.classic.s1, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-accent-blue font-bold">{formatPrice(p.classic.pivot, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-success">{formatPrice(p.classic.r1, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-success">{formatPrice(p.classic.r2, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-success">{formatPrice(p.classic.r3, p.symbol)}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink-muted">—</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink-muted">—</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-danger">{formatPrice(p[selectedMethod].s1, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-accent-blue font-bold">{formatPrice(p.classic.pivot, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-semantic-success">{formatPrice(p[selectedMethod].r1, p.symbol)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink-muted">—</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink-muted">—</td>
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right sidebar: Selected asset chart + method info */}
                <div className="space-y-6">
                  {selectedAsset && (
                    <PivotLevelsChart
                      close={selectedAsset.close}
                      levels={selectedAsset.classic}
                      symbol={selectedAsset.symbol}
                    />
                  )}

                  {/* Method info card */}
                  <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6">
                    <h3 className="text-subhead font-bold text-ink mb-3">Cómo se calculan</h3>
                    <div className="space-y-3 text-body-sm text-ink-muted">
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[18px] text-accent-blue mt-0.5">function</span>
                        <div>
                          <p className="font-medium text-ink">Clásico (Standard)</p>
                          <p className="font-mono text-xs text-ink-subtle">P = (H + L + C) / 3</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[18px] text-accent-blue mt-0.5">auto_awesome</span>
                        <div>
                          <p className="font-medium text-ink">Fibonacci</p>
                          <p className="font-mono text-xs text-ink-subtle">S1 = C − 0.382 × (H − L)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[18px] text-accent-blue mt-0.5">speed</span>
                        <div>
                          <p className="font-medium text-ink">Camarilla</p>
                          <p className="font-mono text-xs text-ink-subtle">S1 = C − 1.1 × (H − L) / 2</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[18px] text-accent-blue mt-0.5">balance</span>
                        <div>
                          <p className="font-medium text-ink">Woodie</p>
                          <p className="font-mono text-xs text-ink-subtle">P = (H + L + 2C) / 4</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[18px] text-accent-blue mt-0.5">calculate</span>
                        <div>
                          <p className="font-medium text-ink">DeMark</p>
                          <p className="font-mono text-xs text-ink-subtle">Ajusta X según C vs O</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pivot Calculator */}
              <section className="mb-10">
                <PivotCalculator />
              </section>
            </>
          )}
        </div>
      </main>

    </>
  )
}
