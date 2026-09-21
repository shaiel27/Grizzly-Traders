'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { clsx } from 'clsx'
import type { Candle, RangeKey } from '@/lib/candles'

export interface ChartLevel {
  price: number
  title: string
  color: string
}

interface MarketChartProps {
  symbol: string
  name: string
  height?: number
  levels?: ChartLevel[]
}

const RANGE_KEYS: RangeKey[] = ['1D', '5D', '1M', '6M', '1Y']
// Long-term levels only make sense on daily and weekly candles
const LEVEL_RANGES: RangeKey[] = ['6M', '1Y']

type LoadResult = { key: string; candles: Candle[]; error?: never } | { key: string; candles?: never; error: string }

function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export function MarketChart({ symbol, name, height = 340, levels = [] }: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const [range, setRange] = useState<RangeKey>('1M')
  const [result, setResult] = useState<LoadResult | null>(null)

  const key = `${symbol}|${range}`
  const loading = result?.key !== key

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const muted = cssVar('--ink-muted', '#999999')
    const grid = cssVar('--hairline-soft', '#1a1a1a')
    const success = cssVar('--semantic-success', '#22c55e')
    const danger = cssVar('--semantic-danger', '#ff3b30')

    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: muted, fontFamily: 'inherit' },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: success,
      downColor: danger,
      wickUpColor: success,
      wickDownColor: danger,
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      priceLinesRef.current = []
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&range=${range}`, {
          signal: controller.signal,
        })
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(body.error ?? 'Error')
        setResult({ key, candles: body.data })
      } catch (error) {
        if (controller.signal.aborted) return
        setResult({ key, error: error instanceof Error ? error.message : 'No se pudo cargar el gráfico' })
      }
    }

    load()
    return () => controller.abort()
  }, [symbol, range, key])

  useEffect(() => {
    const series = seriesRef.current
    if (!series || !result?.candles) return

    series.setData(result.candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })))
    chartRef.current?.timeScale().fitContent()
  }, [result])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    for (const line of priceLinesRef.current) series.removePriceLine(line)
    priceLinesRef.current = []

    if (!LEVEL_RANGES.includes(range)) return
    for (const level of levels) {
      if (!(level.price > 0)) continue
      priceLinesRef.current.push(
        series.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: level.title,
        })
      )
    }
  }, [levels, range])

  const last = result?.candles?.[result.candles.length - 1]
  const first = result?.candles?.[0]
  const change = last && first ? ((last.close - first.open) / first.open) * 100 : null

  return (
    <section
      className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 md:p-5"
      aria-label={`Gráfico de ${name}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-subhead font-bold text-ink">{name}</h3>
          {change !== null && (
            <p className={clsx('font-mono text-micro tabular-nums', change >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}% en el período
            </p>
          )}
        </div>

        <div role="group" aria-label="Período del gráfico" className="flex gap-1 rounded-lg bg-surface-2 p-0.5">
          {RANGE_KEYS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              onClick={() => setRange(option)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-[11px] font-bold tracking-wider transition-colors',
                range === option ? 'bg-surface-container-lowest text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <div ref={containerRef} className="absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest/70" role="status">
            <span className="text-body-sm text-ink-muted">Cargando gráfico…</span>
          </div>
        )}
        {!loading && result?.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-container-lowest px-6 text-center" role="alert">
            <span className="text-body-sm text-ink-muted">{result.error}</span>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-ink-subtle">Datos de Yahoo Finance; pueden tener retraso.</p>
    </section>
  )
}
