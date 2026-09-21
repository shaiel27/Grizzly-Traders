'use client'

import { clsx } from 'clsx'
import { formatNumber, formatPrice } from '@/lib/format'
import type { MarketItem as MarketAsset } from '@/lib/markets'

interface AssetDetailPanelProps {
  asset: MarketAsset | null
}

function getSignal(value: number): { label: string; color: string; icon: string } {
  if (value >= 0.5) return { label: 'Fuerte Compra', color: 'text-semantic-success', icon: 'trending_up' }
  if (value >= 0.2) return { label: 'Compra', color: 'text-semantic-success', icon: 'arrow_upward' }
  if (value <= -0.5) return { label: 'Fuerte Venta', color: 'text-semantic-danger', icon: 'trending_down' }
  if (value <= -0.2) return { label: 'Venta', color: 'text-semantic-danger', icon: 'arrow_downward' }
  return { label: 'Neutral', color: 'text-ink-muted', icon: 'remove' }
}

function get52wPosition(current: number, high: number, low: number): number {
  if (!high || !low || high === low) return 50
  return Math.max(0, Math.min(100, ((current - low) / (high - low)) * 100))
}

export function AssetDetailPanel({ asset }: AssetDetailPanelProps) {
  if (!asset) return null

  const isPositive = asset.change >= 0
  const signal = getSignal(asset.recommendAll)
  const w52 = get52wPosition(asset.close, asset.high52w, asset.low52w)

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between">
        <div>
          <h3 className="text-headline font-bold text-ink">{asset.name}</h3>
          <p className="text-body-sm text-ink-muted">{asset.description}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold tabular-nums text-ink">{formatPrice(asset.close, asset.symbol)}</p>
          <p className={clsx('font-mono text-sm font-bold tabular-nums', isPositive ? 'text-semantic-success' : 'text-semantic-danger')}>
            {isPositive ? '+' : ''}{asset.changeAbs?.toFixed(2)} ({isPositive ? '+' : ''}{asset.change?.toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Price Data */}
        <div className="space-y-4">
          <div>
            <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Datos de Precio</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Apertura', value: formatPrice(asset.open, asset.symbol) },
                { label: 'Máximo', value: formatPrice(asset.high, asset.symbol), color: 'text-semantic-success' },
                { label: 'Mínimo', value: formatPrice(asset.low, asset.symbol), color: 'text-semantic-danger' },
                { label: 'Volumen', value: asset.volume >= 1e9 ? `${(asset.volume / 1e9).toFixed(2)}B` : asset.volume >= 1e6 ? `${(asset.volume / 1e6).toFixed(2)}M` : asset.volume.toLocaleString() },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-outline-variant/30 bg-surface-2/30 px-3 py-2">
                  <p className="text-micro text-ink-muted">{item.label}</p>
                  <p className={clsx('font-mono text-sm font-bold tabular-nums', item.color || 'text-ink')}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 52 Week Range */}
          <div>
            <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Rango 52 Semanas</p>
            <div className="rounded-lg border border-outline-variant/30 bg-surface-2/30 px-4 py-3">
              <div className="flex justify-between mb-2">
                <span className="text-micro text-semantic-danger">{formatPrice(asset.low52w, asset.symbol)}</span>
                <span className="text-micro text-ink-muted">{w52.toFixed(0)}%</span>
                <span className="text-micro text-semantic-success">{formatPrice(asset.high52w, asset.symbol)}</span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-semantic-danger/30 via-accent-blue/20 to-semantic-success/30" />
                <div
                  className="absolute top-0 bottom-0 w-2 bg-ink rounded-full -ml-1 transition-all"
                  style={{ left: `${w52}%` }}
                />
              </div>
            </div>
          </div>

          {/* Performance */}
          <div>
            <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Rendimiento</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '1M', value: asset.perf1M },
                { label: '3M', value: asset.perf3M },
                { label: '6M', value: asset.perf6M },
                { label: 'YTD', value: asset.perfY },
              ].map((p) => (
                <div key={p.label} className="text-center rounded-lg border border-outline-variant/30 bg-surface-2/30 px-2 py-2">
                  <p className="text-micro text-ink-muted">{p.label}</p>
                  <p className={clsx('font-mono text-xs font-bold tabular-nums', (p.value ?? 0) >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                    {p.value != null ? `${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Technical */}
        <div className="space-y-4">
          <div>
            <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Indicadores Técnicos</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'RSI (14)', value: asset.rsi?.toFixed(1), color: (asset.rsi ?? 0) >= 70 ? 'text-semantic-danger' : (asset.rsi ?? 0) <= 30 ? 'text-semantic-success' : 'text-ink' },
                { label: 'ADX', value: asset.adx?.toFixed(1), color: (asset.adx ?? 0) >= 25 ? 'text-accent-blue' : 'text-ink-muted' },
                { label: 'ATR', value: asset.atr?.toFixed(2) },
                { label: 'MACD', value: asset.macd?.toFixed(2) },
                { label: 'EMA 10', value: asset.ema10 ? formatPrice(asset.ema10, asset.symbol) : '—' },
                { label: 'EMA 20', value: asset.ema20 ? formatPrice(asset.ema20, asset.symbol) : '—' },
                { label: 'SMA 50', value: asset.sma50 ? formatPrice(asset.sma50, asset.symbol) : '—' },
                { label: 'SMA 200', value: asset.sma200 ? formatPrice(asset.sma200, asset.symbol) : '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-outline-variant/30 bg-surface-2/30 px-3 py-2">
                  <p className="text-micro text-ink-muted">{item.label}</p>
                  <p className={clsx('font-mono text-sm font-bold tabular-nums', item.color || 'text-ink')}>{item.value ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Signal */}
          <div>
            <p className="text-micro font-bold text-ink-muted uppercase tracking-wider mb-3">Señales de TradingView</p>
            <div className="rounded-lg border border-outline-variant/30 bg-surface-2/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-ink-muted">Recomendación General</span>
                <span className={clsx('flex items-center gap-1 text-sm font-bold', signal.color)}>
                  <span className="material-symbols-outlined text-[16px]">{signal.icon}</span>
                  {signal.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-ink-muted">Recomendación MA</span>
                <span className="text-sm font-bold text-ink">{getSignal(asset.recommendMA).label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-ink-muted">Recomendación Osciladores</span>
                <span className="text-sm font-bold text-ink">{getSignal(asset.recommendOther).label}</span>
              </div>
              {asset.marketCap > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
                  <span className="text-body-sm text-ink-muted">Market Cap</span>
                  <span className="text-sm font-bold text-ink">{formatNumber(asset.marketCap, 0)}</span>
                </div>
              )}
              {asset.beta != null && (
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-ink-muted">Beta (1Y)</span>
                  <span className="text-sm font-bold text-ink">{asset.beta.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
