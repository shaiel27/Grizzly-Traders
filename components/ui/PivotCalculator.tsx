'use client'

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { calculatePivots } from '@/lib/pivots'

interface AssetPreset {
  label: string
  symbol: string
  tvSymbol: string
  icon: string
}

const PRESETS: AssetPreset[] = [
  { label: 'BTC', symbol: 'BTCUSDT', tvSymbol: 'BINANCE:BTCUSDT', icon: 'currency_bitcoin' },
  { label: 'ETH', symbol: 'ETHUSDT', tvSymbol: 'BINANCE:ETHUSDT', icon: 'currency_bitcoin' },
  { label: 'SOL', symbol: 'SOLUSDT', tvSymbol: 'BINANCE:SOLUSDT', icon: 'currency_bitcoin' },
  { label: 'EUR/USD', symbol: 'EURUSD', tvSymbol: 'FX:EURUSD', icon: 'currency_exchange' },
  { label: 'GBP/USD', symbol: 'GBPUSD', tvSymbol: 'FX:GBPUSD', icon: 'currency_exchange' },
  { label: 'XAU/USD', symbol: 'XAUUSD', tvSymbol: 'COMEX:XAUUSD', icon: 'diamond' },
  { label: 'AAPL', symbol: 'AAPL', tvSymbol: 'NASDAQ:AAPL', icon: 'phone_iphone' },
  { label: 'NVDA', symbol: 'NVDA', tvSymbol: 'NASDAQ:NVDA', icon: 'memory' },
  { label: 'S&P 500', symbol: 'SPX', tvSymbol: 'SP:SPX', icon: 'show_chart' },
  { label: 'DXY', symbol: 'DXY', tvSymbol: 'TVC:DXY', icon: 'payments' },
]

function formatLevel(value: number, ref: number): string {
  if (ref >= 10000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (ref >= 100) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (ref < 5) return value.toFixed(5)
  return value.toFixed(2)
}

const METHODS = ['classic', 'fibonacci', 'camarilla', 'woodie', 'demark'] as const
type Method = (typeof METHODS)[number]

const METHOD_INFO: Record<Method, { label: string; desc: string; formula: string }> = {
  classic: { label: 'Clásico', desc: 'El más usado. P = (H+L+C)/3. Soportes y resistencias simétricos.', formula: 'P = (H+L+C)/3' },
  fibonacci: { label: 'Fibonacci', desc: 'Usa ratios 38.2% sobre el rango. Ideal para retracements.', formula: 'S1 = P − 0.382(H−L)' },
  camarilla: { label: 'Camarilla', desc: 'Basado en cierre, rangos estrechos. Para day trading.', formula: 'S1 = C − 1.1(H−L)/12' },
  woodie: { label: 'Woodie', desc: 'Da más peso al cierre. Popular entre day traders.', formula: 'P = (H+L+2C)/4' },
  demark: { label: 'DeMark', desc: 'Ajusta según relación Apertura/Cierre.', formula: 'X = f(C vs O)' },
}

export function PivotCalculator() {
  const [high, setHigh] = useState('')
  const [low, setLow] = useState('')
  const [close, setClose] = useState('')
  const [openPrice, setOpenPrice] = useState('')
  const [activeMethod, setActiveMethod] = useState<Method>('classic')
  const [loadingAsset, setLoadingAsset] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const result = useMemo(() => {
    const h = parseFloat(high)
    const l = parseFloat(low)
    const c = parseFloat(close)
    const o = parseFloat(openPrice) || c
    if (isNaN(h) || isNaN(l) || isNaN(c) || h <= 0 || l <= 0 || c <= 0) return null
    return calculatePivots(h, l, c, o)
  }, [high, low, close, openPrice])

  const loadPreset = async (preset: AssetPreset) => {
    setLoadingAsset(preset.label)
    setActivePreset(preset.label)
    try {
      const res = await fetch(`/api/pivots?symbols=${preset.tvSymbol}`)
      const data = await res.json()
      const d = data.success
        ? (data.data?.find((item: { symbol: string }) => item.symbol === preset.symbol) ?? data.data?.[0])
        : null
      if (d) {
        setHigh(String(d.high))
        setLow(String(d.low))
        setClose(String(d.close))
        setOpenPrice(String(d.open))
      }
    } catch (e) {
      console.error('Failed to load preset:', e)
    } finally {
      setLoadingAsset(null)
    }
  }

  const clearForm = () => {
    setHigh('')
    setLow('')
    setClose('')
    setOpenPrice('')
    setActivePreset(null)
  }

  const h = parseFloat(high) || 0
  const l = parseFloat(low) || 0
  const c = parseFloat(close) || 0
  const range = h - l || 1
  const ref = c || 1

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-headline font-bold text-ink flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-accent-blue">calculate</span>
              Calculadora de Pivot Points
            </h3>
            <p className="text-body-sm text-ink-muted mt-0.5">Selecciona un activo o ingresa datos manualmente</p>
          </div>
          {(high || low || close) && (
            <button onClick={clearForm} className="text-micro text-ink-muted hover:text-ink transition-colors px-3 py-1.5 rounded-lg border border-outline-variant/40 hover:bg-surface-2">
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Asset Presets */}
        <div className="mb-6">
          <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Carga rápida de activos</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => loadPreset(p)}
                disabled={loadingAsset !== null}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all',
                  activePreset === p.label
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-outline-variant/40 bg-surface-2/50 text-ink-muted hover:border-outline-variant hover:text-ink hover:bg-surface-2',
                  loadingAsset === p.label && 'opacity-50 cursor-wait'
                )}
              >
                {loadingAsset === p.label ? (
                  <span className="size-3 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[14px]">{p.icon}</span>
                )}
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-micro text-ink-muted">
          Los presets cargan el rango actual de la sesión. Para pivotes estándar usa el máximo, mínimo y cierre de la
          sesión anterior.
        </p>

        {/* OHLC Inputs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Apertura (O)', value: openPrice, set: setOpenPrice, color: 'text-ink' },
            { label: 'Máximo (H)', value: high, set: setHigh, color: 'text-semantic-success' },
            { label: 'Mínimo (L)', value: low, set: setLow, color: 'text-semantic-danger' },
            { label: 'Cierre (C)', value: close, set: setClose, color: 'text-accent-blue' },
          ].map((input, index) => (
            <div key={input.label}>
              <label htmlFor={`pivot-input-${index}`} className={clsx('text-micro font-medium block mb-1.5', input.color)}>{input.label}</label>
              <input
                id={`pivot-input-${index}`}
                type="number"
                value={input.value}
                onChange={(e) => input.set(e.target.value)}
                placeholder="0.00"
                step="any"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-2 px-3 py-2.5 text-sm font-mono text-ink placeholder:text-ink-subtle focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none transition-colors"
              />
            </div>
          ))}
        </div>

        {/* Quick OHLC info */}
        {h > 0 && l > 0 && c > 0 && (
          <div className="flex items-center gap-4 mb-6 px-4 py-3 rounded-xl bg-surface-2/50 border border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="text-micro text-ink-muted">Rango:</span>
              <span className="font-mono text-xs font-bold text-ink tabular-nums">{formatLevel(range, ref)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-micro text-ink-muted">Volatilidad:</span>
              <span className="font-mono text-xs font-bold text-ink tabular-nums">{((range / c) * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-micro text-ink-muted">Posición C/R:</span>
              <span className={clsx('font-mono text-xs font-bold tabular-nums', c > (h + l) / 2 ? 'text-semantic-success' : 'text-semantic-danger')}>
                {(((c - l) / range) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Method Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-2 mb-4 overflow-x-auto">
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMethod(m)}
              className={clsx(
                'px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-1',
                activeMethod === m
                  ? 'bg-surface-container-lowest text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              {METHOD_INFO[m].label}
            </button>
          ))}
        </div>

        {/* Method Description */}
        <div className="mb-6 px-4 py-3 rounded-xl bg-accent-blue/5 border border-accent-blue/20">
          <p className="text-body-sm text-ink">{METHOD_INFO[activeMethod].desc}</p>
          <p className="font-mono text-xs text-accent-blue mt-1">{METHOD_INFO[activeMethod].formula}</p>
        </div>

        {/* Results */}
        {result ? (
          <div className="space-y-4">
            {/* Classic: full S3-R3 */}
            {activeMethod === 'classic' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Visual bar */}
                <div className="relative rounded-xl border border-outline-variant/40 p-6 bg-surface-2/30">
                  <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-4">Niveles Clásicos</p>
                  <div className="space-y-2">
                    {[
                      { label: 'R3', value: result.classic.r3, color: 'semantic-success', intensity: 30 },
                      { label: 'R2', value: result.classic.r2, color: 'semantic-success', intensity: 22 },
                      { label: 'R1', value: result.classic.r1, color: 'semantic-success', intensity: 15 },
                      { label: 'PP', value: result.classic.pivot, color: 'accent-blue', intensity: 20, main: true },
                      { label: 'S1', value: result.classic.s1, color: 'semantic-danger', intensity: 15 },
                      { label: 'S2', value: result.classic.s2, color: 'semantic-danger', intensity: 22 },
                      { label: 'S3', value: result.classic.s3, color: 'semantic-danger', intensity: 30 },
                    ].map((level) => {
                      const pos = ((level.value - result!.classic.s3) / (result!.classic.r3 - result!.classic.s3)) * 100
                      return (
                        <div key={level.label} className="flex items-center gap-3">
                          <span className={clsx('text-xs font-bold w-8', level.main ? `text-${level.color}` : `text-${level.color}`)}>
                            {level.label}
                          </span>
                          <div className="flex-1 relative h-8 rounded-lg overflow-hidden" style={{ background: `rgba(var(--${level.color}-rgb, 128,128,128), 0.05)` }}>
                            <div
                              className={clsx('absolute inset-y-0 left-0 rounded-lg', `bg-${level.color}/${level.intensity}`)}
                              style={{ width: `${Math.max(5, Math.abs(pos - 50))}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-end pr-3">
                              <span className="font-mono text-xs font-bold tabular-nums text-ink">
                                {formatLevel(level.value, ref)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right: All methods comparison */}
                <div className="rounded-xl border border-outline-variant/40 p-6 bg-surface-2/30">
                  <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-4">Comparación S1 / R1</p>
                  <div className="space-y-3">
                    {METHODS.map((m) => {
                      const data = result![m]
                      const isClassic = m === 'classic'
                      return (
                        <div key={m} className={clsx('rounded-lg border p-3 transition-all', isClassic ? 'border-accent-blue/30 bg-accent-blue/5' : 'border-outline-variant/30')}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={clsx('text-xs font-bold', isClassic ? 'text-accent-blue' : 'text-ink-muted')}>
                              {METHOD_INFO[m].label}
                            </span>
                            {isClassic && <span className="text-[9px] font-bold text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded">ACTUAL</span>}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-[10px] text-semantic-danger font-bold">S1</p>
                              <p className="font-mono text-xs font-bold tabular-nums text-semantic-danger">{formatLevel(data.s1, ref)}</p>
                            </div>
                            {isClassic && (
                              <div>
                                <p className="text-[10px] text-accent-blue font-bold">PP</p>
                                <p className="font-mono text-xs font-bold tabular-nums text-accent-blue">{formatLevel(result!.classic.pivot, ref)}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] text-semantic-success font-bold">R1</p>
                              <p className="font-mono text-xs font-bold tabular-nums text-semantic-success">{formatLevel(data.r1, ref)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Non-classic: S1/R1 only */}
            {activeMethod !== 'classic' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-semantic-danger/30 bg-semantic-danger/5 p-6 text-center">
                  <p className="text-micro font-bold text-semantic-danger uppercase tracking-wider mb-2">S1 (Soporte)</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-semantic-danger">{formatLevel(result[activeMethod].s1, ref)}</p>
                  <p className="text-micro text-ink-subtle mt-1">{((result[activeMethod].s1 - c) / c * 100).toFixed(2)}% del precio</p>
                </div>
                <div className="rounded-xl border border-accent-blue/30 bg-accent-blue/5 p-6 text-center">
                  <p className="text-micro font-bold text-accent-blue uppercase tracking-wider mb-2">Pivot Point</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-accent-blue">
                    {formatLevel('pivot' in result[activeMethod] ? (result[activeMethod] as { pivot: number }).pivot : result.classic.pivot, ref)}
                  </p>
                  <p className="text-micro text-ink-subtle mt-1">Punto de equilibrio</p>
                </div>
                <div className="rounded-xl border border-semantic-success/30 bg-semantic-success/5 p-6 text-center">
                  <p className="text-micro font-bold text-semantic-success uppercase tracking-wider mb-2">R1 (Resistencia)</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-semantic-success">{formatLevel(result[activeMethod].r1, ref)}</p>
                  <p className="text-micro text-ink-subtle mt-1">{((result[activeMethod].r1 - c) / c * 100).toFixed(2)}% del precio</p>
                </div>
              </div>
            )}

            {/* Price position indicator */}
            {c > 0 && (
              <div className="rounded-xl border border-outline-variant/40 p-4 bg-surface-2/30">
                <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Posición del precio actual</p>
                <div className="relative h-6 rounded-full bg-surface-2 overflow-hidden">
                  <div className="absolute inset-0 flex">
                    <div className="flex-1 bg-gradient-to-r from-semantic-danger/20 to-transparent" />
                    <div className="w-px bg-accent-blue/40" />
                    <div className="flex-1 bg-gradient-to-l from-semantic-success/20 to-transparent" />
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-ink rounded-full transition-all"
                    style={{ left: `${Math.min(98, Math.max(2, ((c - result!.classic.s3) / (result!.classic.r3 - result!.classic.s3)) * 100))}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] font-mono text-semantic-danger">S3: {formatLevel(result!.classic.s3, ref)}</span>
                  <span className="text-[10px] font-mono text-ink font-bold">ACTUAL: {formatLevel(c, ref)}</span>
                  <span className="text-[10px] font-mono text-semantic-success">R3: {formatLevel(result!.classic.r3, ref)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-outline-variant/40 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-ink-subtle mb-3 block">candlestick_chart</span>
            <p className="text-body text-ink-muted mb-1">Selecciona un activo o ingresa datos</p>
            <p className="text-micro text-ink-subtle">Haz clic en uno de los botones de arriba para cargar datos reales</p>
          </div>
        )}
      </div>
    </div>
  )
}
