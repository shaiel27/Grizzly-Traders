'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from 'lightweight-charts'
import { clsx } from 'clsx'
import { TIMEFRAMES, TIMEFRAME_KEYS, type Candle, type TimeframeKey } from '@/lib/candles'
import { formatCompact, formatLevel } from '@/lib/format'
import { INDICATORS, toLinePoints, type IndicatorKey } from '@/lib/indicators'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import { t } from '@/lib/i18n/get-dictionary'

export interface ChartLevel {
  price: number
  title: string
  color: string
}

interface MarketChartProps {
  symbol: string
  name: string
  height?: number
  // Horizontal reference lines (e.g. daily pivots); the toolbar gets a switch for them when present
  levels?: ChartLevel[]
  // Defaults to dict.marketChart.pivotsLabel (resolved inside the component) when omitted
  levelsLabel?: string
  initialTimeframe?: TimeframeKey
  // Drops the frame so the chart can live inside another panel
  bare?: boolean
}

type LoadState =
  | { key: string; status: 'ready'; candles: Candle[]; stale: boolean }
  | { key: string; status: 'no-data'; message: string; reason: 'asset' | 'timeframe' }
  | { key: string; status: 'error'; message: string }

type Overlay = IndicatorKey | 'volume'

const DEFAULT_OVERLAYS: Overlay[] = ['sma50', 'sma200', 'volume']

// fitContent() crams the ENTIRE fetched range into the available width — e.g. 1d fetches 2y of daily
// candles (~500 bars), 1h fetches 3mo of hourly ones (~400 bars). Past a certain density the bodies
// get thinner than the moving-average lines drawn over them and the whole chart reads as a grey
// blur. Default to a recent, legible window on every timeframe instead — the rest of the fetched
// range is still loaded, a scroll/pinch-zoom away. ~7-8px per candle at the panel's usual width is
// comfortable regardless of timeframe, so one flat count works across all of them.
const DEFAULT_VISIBLE_BARS = 120

// Decimals on the price axis: 2 is useless for forex, where the interesting moves are in the 4th and 5th
function axisPrecision(reference: number): number {
  if (reference >= 100) return 2
  if (reference >= 10) return 3
  if (reference >= 1) return 5
  return 6
}

function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function signed(value: number, decimals = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function MarketChart({
  symbol,
  name,
  height = 420,
  levels = [],
  levelsLabel,
  initialTimeframe = '1d',
  bare = false,
}: MarketChartProps) {
  const dict = useDictionary()
  const resolvedLevelsLabel = levelsLabel ?? dict.marketChart.pivotsLabel
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lineRefs = useRef(new Map<IndicatorKey, ISeriesApi<'Line'>>())
  const priceLinesRef = useRef<IPriceLine[]>([])
  const fittedKeyRef = useRef<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [timeframe, setTimeframe] = useState<TimeframeKey>(initialTimeframe)
  const [overlays, setOverlays] = useState<Overlay[]>(DEFAULT_OVERLAYS)
  const [levelsOn, setLevelsOn] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  const spec = TIMEFRAMES[timeframe]
  const key = `${symbol}|${timeframe}|${attempt}`
  const loading = state?.key !== key
  const candles = state?.status === 'ready' ? state.candles : null
  // Intraday candles are shown in the viewer's clock; daily and longer ones already sit on a calendar day
  const shift = useMemo(() => (spec.intraday ? -new Date().getTimezoneOffset() * 60 : 0), [spec.intraday])
  const precision = candles?.length ? axisPrecision(candles[candles.length - 1].close) : 2
  // Lookup for the legend: the crosshair reports the (shifted) time of the hovered candle
  const candleByTime = useMemo(() => {
    const byTime = new Map<number, { candle: Candle; previousClose: number | null }>()
    candles?.forEach((candle, index) => byTime.set(candle.time + shift, { candle, previousClose: index > 0 ? candles[index - 1].close : null }))
    return byTime
  }, [candles, shift])

  // Chart instance: created once, everything else updates it
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const muted = cssVar('--ink-muted', '#999999')
    const grid = cssVar('--hairline-soft', '#1a1a1a')
    const success = cssVar('--semantic-success', '#22c55e')
    const danger = cssVar('--semantic-danger', '#ff3b30')

    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: muted, fontFamily: 'inherit', fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: grid } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderVisible: false, secondsVisible: false, rightOffset: 6 },
      crosshair: { mode: CrosshairMode.Normal },
    })
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: success,
      downColor: danger,
      wickUpColor: success,
      wickDownColor: danger,
      borderVisible: false,
    })

    const onMove = (param: MouseEventParams) => {
      const data = param.seriesData.get(candle) as CandlestickData | undefined
      setHoverTime(data && typeof param.time === 'number' ? param.time : null)
    }
    chart.subscribeCrosshairMove(onMove)

    const lines = lineRefs.current
    chartRef.current = chart
    candleRef.current = candle

    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      lines.clear()
      priceLinesRef.current = []
      fittedKeyRef.current = null
    }
  }, [])

  // Candles for the selected symbol and timeframe
  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`, { signal: controller.signal })
        const body = await response.json().catch(() => ({}))
        if (body.noData || response.status === 404) {
          setState({ key, status: 'no-data', message: body.error ?? dict.marketChart.noDataForAsset, reason: body.reason === 'asset' ? 'asset' : 'timeframe' })
        } else if (!response.ok || !body.success) {
          throw new Error(body.error ?? dict.marketChart.loadFailed)
        } else {
          setState({ key, status: 'ready', candles: body.data, stale: body.stale === true })
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ key, status: 'error', message: error instanceof Error ? error.message : dict.marketChart.loadFailed })
      }
    }

    load()
    return () => controller.abort()
  }, [symbol, timeframe, key, dict.marketChart.noDataForAsset, dict.marketChart.loadFailed])

  // Candles, volume and moving averages
  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleRef.current
    if (!chart || !candleSeries || !candles) return

    chart.timeScale().applyOptions({ timeVisible: spec.intraday })
    candleSeries.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
    candleSeries.setData(candles.map((c) => ({ time: (c.time + shift) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })))

    const hasVolume = candles.some((c) => c.volume !== undefined)
    if (overlays.includes('volume') && hasVolume) {
      if (!volumeRef.current) {
        volumeRef.current = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
      }
      const up = cssVar('--semantic-success', '#22c55e')
      const down = cssVar('--semantic-danger', '#ff3b30')
      volumeRef.current.setData(
        candles.map((c) => ({ time: (c.time + shift) as UTCTimestamp, value: c.volume ?? 0, color: `${c.close >= c.open ? up : down}55` }))
      )
    } else if (volumeRef.current) {
      chart.removeSeries(volumeRef.current)
      volumeRef.current = null
    }

    const closes = candles.map((c) => c.close)
    for (const indicator of INDICATORS) {
      const existing = lineRefs.current.get(indicator.key)
      if (!overlays.includes(indicator.key)) {
        if (existing) {
          chart.removeSeries(existing)
          lineRefs.current.delete(indicator.key)
        }
        continue
      }

      const series =
        existing ??
        chart.addSeries(LineSeries, {
          color: indicator.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
      lineRefs.current.set(indicator.key, series)
      series.setData(toLinePoints(candles, indicator.compute(closes)).map((point) => ({ time: (point.time + shift) as UTCTimestamp, value: point.value })))
    }

    // Fit only when the symbol or timeframe changes: toggling an indicator must not throw away the zoom
    const fitKey = `${symbol}|${timeframe}|${attempt}`
    if (fittedKeyRef.current !== fitKey) {
      if (candles.length > DEFAULT_VISIBLE_BARS) {
        const to = candles.length - 1
        chart.timeScale().setVisibleLogicalRange({ from: to - DEFAULT_VISIBLE_BARS, to })
      } else {
        chart.timeScale().fitContent()
      }
      fittedKeyRef.current = fitKey
    }
  }, [candles, overlays, shift, spec.intraday, precision, symbol, timeframe, attempt])

  // Horizontal levels
  useEffect(() => {
    const chart = chartRef.current
    const series = candleRef.current
    if (!chart || !series) return

    // Pivots (R3..S3) stack up to 7 price-line labels on the right axis; with the default 8% margin
    // they crowd the top edge and collide with the axis's own tick labels. A bit more headroom when
    // they're shown spreads the cluster out and keeps it off the border.
    chart.priceScale('right').applyOptions({
      scaleMargins: levelsOn && levels.length > 0 ? { top: 0.14, bottom: 0.08 } : { top: 0.08, bottom: 0.08 },
    })

    for (const line of priceLinesRef.current) series.removePriceLine(line)
    priceLinesRef.current = []
    if (!levelsOn) return

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
  }, [levels, levelsOn])

  // Close the indicator menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const toggleOverlay = useCallback((overlay: Overlay) => {
    setOverlays((current) => (current.includes(overlay) ? current.filter((item) => item !== overlay) : [...current, overlay]))
  }, [])

  // The legend follows the crosshair and rests on the latest candle
  const lastCandle = candles?.length ? candles[candles.length - 1] : null
  const hovered = hoverTime !== null ? candleByTime.get(hoverTime) : undefined
  const shown = hovered?.candle ?? lastCandle
  const previousClose = hovered ? hovered.previousClose : candles && candles.length > 1 ? candles[candles.length - 2].close : null
  const changePct = shown && previousClose ? ((shown.close - previousClose) / previousClose) * 100 : null
  const reference = shown?.close ?? 1
  const hasVolume = candles?.some((c) => c.volume !== undefined) ?? false
  const activeIndicators = INDICATORS.filter((indicator) => overlays.includes(indicator.key))

  return (
    <section
      className={clsx('flex flex-col', !bare && 'rounded-[10px] border border-hairline bg-surface-container-lowest')}
      aria-label={`Gráfico de ${name}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline-soft px-3 py-2">
        <div role="group" aria-label={dict.marketChart.timeframeAria} className="flex items-center gap-0.5">
          {TIMEFRAME_KEYS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={timeframe === option}
              onClick={() => setTimeframe(option)}
              className={clsx(
                'h-7 min-w-9 rounded-sm px-2 text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                timeframe === option ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-1 hover:text-ink'
              )}
            >
              {TIMEFRAMES[option].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {levels.length > 0 && (
            <button
              type="button"
              aria-pressed={levelsOn}
              onClick={() => setLevelsOn((value) => !value)}
              className={clsx(
                'h-7 rounded-sm px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue',
                levelsOn ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-1 hover:text-ink'
              )}
            >
              {resolvedLevelsLabel}
            </button>
          )}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-7 items-center gap-1 rounded-sm px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              {dict.marketChart.indicatorsLabel}
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                expand_more
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-56 rounded-[8px] border border-hairline bg-surface-container-low p-1 shadow-xl">
                {INDICATORS.map((indicator) => (
                  <label key={indicator.key} className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px] text-ink hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={overlays.includes(indicator.key)}
                      onChange={() => toggleOverlay(indicator.key)}
                      className="size-3.5 accent-[var(--accent-blue)]"
                    />
                    <span className="size-2 rounded-full" style={{ backgroundColor: indicator.color }} aria-hidden="true" />
                    {dict.indicators[indicator.key]}
                  </label>
                ))}
                <label
                  className={clsx(
                    'flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-[13px]',
                    hasVolume ? 'cursor-pointer text-ink hover:bg-surface-2' : 'cursor-not-allowed text-ink-subtle'
                  )}
                  title={hasVolume ? undefined : dict.marketChart.noVolumeTooltip}
                >
                  <input
                    type="checkbox"
                    checked={overlays.includes('volume')}
                    disabled={!hasVolume}
                    onChange={() => toggleOverlay('volume')}
                    className="size-3.5 accent-[var(--accent-blue)]"
                  />
                  <span className="size-2 rounded-full bg-ink-subtle" aria-hidden="true" />
                  {dict.marketChart.volumeLabel}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative" style={{ height }}>
        <div ref={containerRef} className="absolute inset-0" />

        {shown && !loading && (
          <div className="pointer-events-none absolute left-3 top-2 z-10 max-w-[calc(100%-5rem)] space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px] tabular-nums text-ink-muted">
            <span className="text-ink">{name}</span>
            <span>
              A <span className="text-ink">{formatLevel(shown.open, reference, symbol)}</span>
            </span>
            <span>
              Máx <span className="text-ink">{formatLevel(shown.high, reference, symbol)}</span>
            </span>
            <span>
              Mín <span className="text-ink">{formatLevel(shown.low, reference, symbol)}</span>
            </span>
            <span>
              C <span className="text-ink">{formatLevel(shown.close, reference, symbol)}</span>
            </span>
            {changePct !== null && <span className={changePct >= 0 ? 'text-semantic-success' : 'text-semantic-danger'}>{signed(changePct)}</span>}
            {shown.volume !== undefined && overlays.includes('volume') && (
              <span>
                Vol <span className="text-ink">{formatCompact(shown.volume)}</span>
              </span>
            )}
          </div>
            {activeIndicators.length > 0 && (
              <ul className="flex flex-wrap gap-x-3 text-[11px] text-ink-subtle">
                {activeIndicators.map((indicator) => (
                  <li key={indicator.key} className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: indicator.color }} aria-hidden="true" />
                    {dict.indicators[indicator.key]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-lowest/70" role="status">
            <span className="text-[13px] text-ink-muted">{t(dict.marketChart.loadingTimeframe, { timeframe: TIMEFRAMES[timeframe].label })}</span>
          </div>
        )}

        {!loading && state && state.status !== 'ready' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest px-8 text-center" role="alert">
            <p className="max-w-sm text-[14px] text-ink">{state.message}</p>
            {state.status === 'error' ? (
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="h-8 rounded-[6px] border border-hairline px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
              >
                {dict.marketChart.retry}
              </button>
            ) : (
              <p className="max-w-sm text-[13px] text-ink-muted">
                {state.reason === 'asset' ? dict.marketChart.noDataAssetHint : dict.marketChart.noDataTimeframeHint}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="border-t border-hairline-soft px-3 py-2 text-[11px] text-ink-subtle" aria-live="polite">
        {state?.status === 'ready' && state.stale ? dict.marketChart.staleData : dict.marketChart.sourceNote}
      </p>
    </section>
  )
}
