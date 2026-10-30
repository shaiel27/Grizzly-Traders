'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  type CandlestickData,
  type IChartApi,
  type IPaneApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesPartialOptionsMap,
  type TickMarkFormatter,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { clsx } from 'clsx'
import { TIMEFRAMES, TIMEFRAME_KEYS, applyLiveTick, intervalSeconds, type Candle, type TimeframeKey } from '@/lib/candles'
import { formatCompact, formatLevel } from '@/lib/format'
import { INDICATORS, OSCILLATORS, macd, rsi, toLinePoints, type IndicatorKey, type LinePoint, type OscillatorKey } from '@/lib/indicators'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import { t } from '@/lib/i18n/get-dictionary'
import { TradingViewWidget, usesTradingViewChart } from './TradingViewWidget'

export interface ChartLevel {
  price: number
  title: string
  color: string
}

// Precio en vivo del scanner para el símbolo mostrado
interface LiveQuote {
  close: number
  change?: number
  changeAbs?: number
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
  // Live scanner price for the current symbol. When the caller owns the quote poll (MarketsClient
  // already polls /api/quote for the header) it passes the value here; when the prop is omitted
  // entirely (e.g. PivotAssetPanel) the chart polls /api/quote itself every few seconds.
  // `null` means "caller owns the poll but has no data yet" — never self-poll in that case.
  liveQuote?: LiveQuote | null
  // Retraso del dato (MarketItem.delayMinutes); solo lo usa el widget de TradingView, que rotula
  // el diferido bajo el gráfico
  delayMinutes?: number | null
  // false = nunca el widget de TradingView (p. ej. pivotes: el widget no dibuja los niveles); un futuro
  // sin velas cae entonces en el estado vacío del gráfico propio, como US02Y
  allowWidget?: boolean
}

type LoadState =
  | { key: string; status: 'ready'; candles: Candle[]; stale: boolean }
  | { key: string; status: 'no-data'; reason: 'asset' | 'timeframe' }
  | { key: string; status: 'error' }

type Overlay = IndicatorKey | 'volume'

const DEFAULT_OVERLAYS: Overlay[] = ['sma50', 'sma200', 'volume']

// fitContent() crams the ENTIRE fetched range into the available width — e.g. 1d fetches 2y of daily
// candles (~500 bars), 1h fetches 3mo of hourly ones (~400 bars). Past a certain density the bodies
// get thinner than the moving-average lines drawn over them and the whole chart reads as a grey
// blur. Default to a recent, legible window on every timeframe instead — the rest of the fetched
// range is still loaded, a scroll/pinch-zoom away. ~7-8px per candle at the panel's usual width is
// comfortable regardless of timeframe, so one flat count works across all of them.
const DEFAULT_VISIBLE_BARS = 120
// Hueco a la derecha de la última vela: la etiqueta del precio actual no tapa la vela en curso
const RIGHT_OFFSET_BARS = 6
const MACD_SIGNAL_COLOR = '#fbbf24'

// Altura objetivo de cada panel de oscilador (RSI, MACD). Se expresa como stretch factor y se
// recalcula en cada sync: los setHeight de lightweight-charts operan con alturas del modelo que
// solo se refrescan al pintar, así que varios setHeight en el mismo tick se pisarían entre sí
const OSCILLATOR_PANE_HEIGHT = 100

// Cadencia del precio en vivo del scanner: más rápida que cualquier temporalidad para que la
// última barra y la leyenda se muevan casi en tiempo real
const LIVE_POLL_MS = 7_000

// Decimals on the price axis: taken from formatLevel itself — the formatter the legend and the pivot
// levels already use — so one price never renders with two different digit counts (a JPY or 5-decimals
// forex pair used to show 2 digits on the axis labels and 3/5 on the legend and level labels).
function axisPrecision(reference: number, symbol: string): number {
  const formatted = formatLevel(reference, reference, symbol)
  const dot = formatted.lastIndexOf('.')
  return dot === -1 ? 2 : formatted.length - dot - 1
}

// The series stores pure UTC epoch seconds; every label is rendered in the viewer's clock at paint
// time instead. Baking a timezone offset into the data (the old `shift`) labels the whole history
// with the offset in force TODAY, so every bar older than the last DST change sits an hour off — and
// it also shifted the keys the crosshair lookup runs on. Intl.DateTimeFormat applies the offset in
// force on each bar's own date, so history stays right all year round.
const TICK_MARK_OPTIONS: Record<TickMarkType, Intl.DateTimeFormatOptions> = {
  [TickMarkType.Year]: { year: 'numeric' },
  [TickMarkType.Month]: { month: 'short' },
  [TickMarkType.DayOfMonth]: { day: 'numeric' },
  [TickMarkType.Time]: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  [TickMarkType.TimeWithSeconds]: { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' },
}

// Crosshair time half; the date half keeps the library's own `dd MMM 'yy` shape (see crosshairLabel)
const CROSSHAIR_TIME_OPTIONS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
const MONTH_SHORT_OPTIONS: Intl.DateTimeFormatOptions = { month: 'short' }

// The time scale formats on every frame, so the Intl.DateTimeFormat instances (the expensive part)
// are cached per locale + shape; the whole map stays at a handful of entries.
const formatters = new Map<string, Intl.DateTimeFormat>()

function cachedFormatter(locale: string, key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const cacheKey = `${locale}|${key}`
  let formatter = formatters.get(cacheKey)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options)
    formatters.set(cacheKey, formatter)
  }
  return formatter
}

// Every candle is pushed as UTCTimestamp, never as BusinessDay
function timeToDate(time: Time): Date {
  return new Date((time as UTCTimestamp) * 1000)
}

const tickMarkFormatter: TickMarkFormatter = (time, tickMarkType, locale) =>
  cachedFormatter(locale, `tick-${tickMarkType}`, TICK_MARK_OPTIONS[tickMarkType]).format(timeToDate(time))

// Same shape the library writes by default ('05 Mar 26   14:30'), but read from the local date/time
// of the bar instead of the UTC one
function crosshairLabel(time: Time, intraday: boolean, locale: string): string {
  const date = timeToDate(time)
  const day = String(date.getDate()).padStart(2, '0')
  const month = cachedFormatter(locale, 'month-short', MONTH_SHORT_OPTIONS).format(new Date(date.getFullYear(), date.getMonth(), 1))
  const year = String(date.getFullYear() % 100).padStart(2, '0')
  const label = `${day} ${month} '${year}`
  return intraday ? `${label}   ${cachedFormatter(locale, 'crosshair-time', CROSSHAIR_TIME_OPTIONS).format(date)}` : label
}

function cssVar(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function signed(value: number, decimals = 2): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// Los valores MACD van de ~0.0005 (divisas) a decenas (índices): con menos de 1 hacen falta
// cuatro decimales para no colapsar en la línea del cero
function macdAxisFormatter(value: number): string {
  return Math.abs(value) < 1 ? value.toFixed(4) : value.toFixed(2)
}

// Cada panel de oscilador agrupa su pane y las series que viven dentro (RSI: 1 línea;
// MACD: histograma + línea + señal)
interface OscillatorPane {
  pane: IPaneApi<Time>
  series: ISeriesApi<'Line' | 'Histogram'>[]
}

function MarketChartCanvas({
  symbol,
  name,
  height = 420,
  levels = [],
  levelsLabel,
  initialTimeframe = '1d',
  bare = false,
  liveQuote,
}: MarketChartProps) {
  const dict = useDictionary()
  const { locale } = useLocale()
  const resolvedLevelsLabel = levelsLabel ?? dict.marketChart.pivotsLabel
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const lineRefs = useRef(new Map<IndicatorKey, ISeriesApi<'Line'>>())
  const oscillatorRefs = useRef(new Map<OscillatorKey, OscillatorPane>())
  // Identity of each price line is its axis title (R3..S3): the set is diffed instead of rebuilt
  const priceLinesRef = useRef(new Map<string, IPriceLine>())
  const fittedKeyRef = useRef<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null)

  const [timeframe, setTimeframe] = useState<TimeframeKey>(initialTimeframe)
  const [overlays, setOverlays] = useState<Overlay[]>(DEFAULT_OVERLAYS)
  const [oscillators, setOscillators] = useState<OscillatorKey[]>([])
  const [levelsOn, setLevelsOn] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  // Roving tabindex inside the indicator menu: only the focused item sits in the tab order
  const [menuFocusIndex, setMenuFocusIndex] = useState(0)
  // El estado del fullscreen nunca sale de la promesa de requestFullscreen: se deriva del
  // documento en cada fullscreenchange, así que Esc del sistema (o F11) también lo reflejan
  const [fullscreen, setFullscreen] = useState(false)
  // Avisos del aria-live de exportación. Se vacía en cada intento para que un fallo
  // repetido se vuelva a anunciar (con el texto intacto el lector de pantalla no relee nada)
  const [exportError, setExportError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  // Etiquetado con su símbolo: al cambiar de activo el precio anterior queda solo y se ignora,
  // sin necesidad de vaciarlo con un setState dentro del effect
  const [selfQuote, setSelfQuote] = useState<{ symbol: string; quote: LiveQuote } | null>(null)

  const spec = TIMEFRAMES[timeframe]
  // Read by the formatters the chart was created with (they close over these, they can't re-run):
  // the locale also reaches the library through localization.locale so tick marks and crosshair agree.
  // Se actualizan en un effect: escribir refs durante el render las congela para el effect que crea
  // el gráfico y las formateadores, y React lo prohíbe.
  const localeRef = useRef(locale)
  const intradayRef = useRef(spec.intraday)
  useEffect(() => {
    localeRef.current = locale
    intradayRef.current = spec.intraday
  }, [locale, spec.intraday])
  // Duración del bucket mostrado: los ticks en vivo solo reescriben la vela si su bucket sigue abierto
  const bucketSeconds = ('aggregateSeconds' in spec && spec.aggregateSeconds) || intervalSeconds(spec.interval)
  const key = `${symbol}|${timeframe}|${attempt}`
  const loading = state?.key !== key
  // Solo las velas de la clave actual: las del activo/temporalidad anterior nunca se pintan con
  // la precisión, los niveles o el encuadre del nuevo mientras éste carga
  const candles = state?.status === 'ready' && state.key === key ? state.candles : null
  const levelsAllowed = timeframe !== '1w' && timeframe !== '1mo'
  const levelsShown = levelsOn && levelsAllowed && levels.length > 0
  // Fuente del precio en vivo: prop omitida → la consulta propia del gráfico; null → el caller
  // tiene la consulta pero todavía sin datos; objeto → el caller manda y no se consulta nada
  const selfPoll = liveQuote === undefined
  const ownQuote = selfPoll && selfQuote?.symbol === symbol ? selfQuote.quote : null
  const live = selfPoll ? ownQuote : liveQuote
  const liveClose = live?.close ?? null
  // Lo que el gráfico y la leyenda deben mostrar: la última vela ajustada con el tick en vivo
  const displayCandles = useMemo(
    () => (candles && liveClose !== null ? applyLiveTick(candles, liveClose, bucketSeconds) : candles),
    [candles, liveClose, bucketSeconds]
  )
  // Pinned to the latest close (not to the hovered one): the priceFormat drives the axis labels and
  // the crosshair, and rewriting it on every hover would rebuild them constantly. The digits match
  // formatLevel's, so legend, level labels and axis never disagree.
  const axisReference = candles?.length ? candles[candles.length - 1].close : null
  const precision = axisReference !== null ? axisPrecision(axisReference, symbol) : 2
  const hasVolume = candles?.some((c) => c.volume !== undefined) ?? false
  const volumeShown = hasVolume && overlays.includes('volume')
  const closes = useMemo(() => candles?.map((c) => c.close) ?? [], [candles])
  // Cada indicador se calcula una vez por lote de velas y alimenta a la vez su serie y la leyenda
  const overlayPoints = useMemo(() => {
    const byKey = new Map<IndicatorKey, LinePoint[]>()
    if (!candles) return byKey
    for (const indicator of INDICATORS) {
      if (overlays.includes(indicator.key)) byKey.set(indicator.key, toLinePoints(candles, indicator.compute(closes)))
    }
    return byKey
  }, [candles, closes, overlays])
  const oscillatorPoints = useMemo(() => {
    if (!candles) return null
    const result: { rsi?: LinePoint[]; macd?: { macd: LinePoint[]; signal: LinePoint[]; histogram: LinePoint[] } } = {}
    if (oscillators.includes('rsi')) result.rsi = toLinePoints(candles, rsi(closes))
    if (oscillators.includes('macd')) {
      const values = macd(closes)
      result.macd = {
        macd: toLinePoints(candles, values.macd),
        signal: toLinePoints(candles, values.signal),
        histogram: toLinePoints(candles, values.histogram),
      }
    }
    return result
  }, [candles, closes, oscillators])
  const legendValues = useMemo(() => {
    const byKey = new Map<IndicatorKey | OscillatorKey, Map<number, number>>()
    for (const [indicatorKey, points] of overlayPoints) byKey.set(indicatorKey, new Map(points.map((point) => [point.time, point.value])))
    if (oscillatorPoints?.rsi) byKey.set('rsi', new Map(oscillatorPoints.rsi.map((point) => [point.time, point.value])))
    if (oscillatorPoints?.macd) byKey.set('macd', new Map(oscillatorPoints.macd.macd.map((point) => [point.time, point.value])))
    return byKey
  }, [overlayPoints, oscillatorPoints])
  // Lookup for the legend: the crosshair reports the UTC time of the hovered candle, and so does the map
  const candleByTime = useMemo(() => {
    const byTime = new Map<number, { candle: Candle; previousClose: number | null }>()
    displayCandles?.forEach((candle, index) =>
      byTime.set(candle.time, { candle, previousClose: index > 0 ? displayCandles[index - 1].close : null })
    )
    return byTime
  }, [displayCandles])

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
      timeScale: { borderVisible: false, secondsVisible: false, rightOffset: RIGHT_OFFSET_BARS, tickMarkFormatter },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: `${muted}80`, labelBackgroundColor: '#2a2a2a' },
        horzLine: { color: `${muted}80`, labelBackgroundColor: '#2a2a2a' },
      },
      localization: {
        locale: localeRef.current,
        timeFormatter: (time: Time) => crosshairLabel(time, intradayRef.current, localeRef.current),
      },
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
    const priceLines = priceLinesRef.current
    const oscillatorPanes = oscillatorRefs.current
    chartRef.current = chart
    candleRef.current = candle

    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      lines.clear()
      priceLines.clear()
      oscillatorPanes.clear()
      fittedKeyRef.current = null
    }
  }, [])

  // El locale cambia con la cookie (router.refresh); los formateadores leen localeRef, pero la
  // localización del gráfico guarda la suya y es la que pasa a tickMarkFormatter
  useEffect(() => {
    chartRef.current?.applyOptions({ localization: { locale } })
  }, [locale])

  // El único oracle del fullscreen es el documento: la salida con Esc (o desde las
  // devtools) no pasa por el botón, y el icono, el aria-pressed y el botón de salida
  // deben reflejarla igual. containerRef es el elemento a pantalla completa, no la
  // sección: autoSize observa ese contenedor y solo tiene que rellenarlo.
  // Al salir, el foco vuelve al botón de la barra (el botón de salida vive dentro del
  // contenedor a pantalla completa y desaparece con él); sin esto, Esc deja el foco en
  // el body y hay que tabular desde arriba del documento.
  useEffect(() => {
    const sync = () => {
      const active = document.fullscreenElement === containerRef.current
      if (fullscreen && !active) fullscreenButtonRef.current?.focus()
      setFullscreen(active)
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [fullscreen])

  // Candles del símbolo y la temporalidad. La carga inicial (o un reintento) puede acabar en
  // error/sin-datos; a partir de ahí se refrescan en silencio a la cadencia de la caché del
  // servidor: mismas claves en el estado para no parpadear el overlay de carga, un refresco
  // fallido conserva el último estado bueno, y un refresco exitoso también recuperaria una
  // pantalla de error/sin-datos dejada por un fallo transitorio del proveedor
  useEffect(() => {
    const controller = new AbortController()
    let done = false

    async function load(silent: boolean) {
      if (silent && document.hidden) return
      try {
        const response = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`, { signal: controller.signal })
        const body = await response.json().catch(() => ({}))
        if (done || controller.signal.aborted) return
        if (body.noData || response.status === 404) {
          if (silent) return
          setState({ key, status: 'no-data', reason: body.reason === 'asset' ? 'asset' : 'timeframe' })
        } else if (!response.ok || !body.success || !Array.isArray(body.data)) {
          throw new Error(`candles ${response.status}`)
        } else {
          setState((prev) => (silent && prev && prev.key !== key ? prev : { key, status: 'ready', candles: body.data, stale: body.stale === true }))
        }
      } catch {
        if (done || controller.signal.aborted || silent) return
        setState({ key, status: 'error' })
      }
    }

    load(false)
    const interval = setInterval(() => load(true), spec.ttlMs)
    const onVisibility = () => {
      if (!document.hidden) load(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      done = true
      controller.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [symbol, timeframe, key, spec.ttlMs])

  // Precio en vivo del scanner: solo cuando la prop liveQuote está omitida. Nunca pinta error:
  // una respuesta mala conserva el último precio bueno y listo
  useEffect(() => {
    if (!selfPoll) return
    const controller = new AbortController()
    let done = false

    async function poll() {
      if (document.hidden) return
      try {
        const response = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) return
        const body = await response.json().catch(() => null)
        if (done || controller.signal.aborted) return
        const data = body?.success ? body.data : null
        if (data && Number.isFinite(data.close) && data.close > 0) {
          setSelfQuote({ symbol, quote: { close: data.close, change: data.change, changeAbs: data.changeAbs } })
        }
      } catch {
        // sin red o abort: se conserva el último valor
      }
    }

    poll()
    const interval = setInterval(poll, LIVE_POLL_MS)
    const onVisibility = () => {
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      done = true
      controller.abort()
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [selfPoll, symbol])

  // El chart ya no se remonta al cambiar de símbolo (para conservar timeframe e indicadores):
  // mientras no hay velas válidas para la clave actual (carga inicial, cambio de activo, error),
  // el plot queda vacío en vez de conservar las del símbolo anterior. Las series se vacían, no se
  // destruyen: al llegar las velas nuevas se re-alimentan sin recrearlas
  useEffect(() => {
    const candleSeries = candleRef.current
    if (!candleSeries || candles) return
    candleSeries.setData([])
    volumeRef.current?.setData([])
    for (const [, series] of lineRefs.current) series.setData([])
    for (const [, pane] of oscillatorRefs.current) {
      for (const series of pane.series) series.setData([])
    }
  }, [candles])

  // Velas y encuadre. Solo depende de las velas y su formato: activar un indicador ya no
  // reescribe la serie de precio
  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candleRef.current
    if (!chart || !candleSeries || !candles || axisReference === null) return

    chart.timeScale().applyOptions({ timeVisible: spec.intraday })
    candleSeries.applyOptions({
      priceFormat: { type: 'custom', minMove: 10 ** -precision, formatter: (price: number) => formatLevel(price, axisReference, symbol) },
    })
    candleSeries.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })))

    // Fit only when the symbol or timeframe changes: toggling an indicator must not throw away the zoom
    const fitKey = `${symbol}|${timeframe}|${attempt}`
    if (fittedKeyRef.current !== fitKey) {
      if (candles.length > DEFAULT_VISIBLE_BARS) {
        const to = candles.length - 1
        chart.timeScale().setVisibleLogicalRange({ from: to - DEFAULT_VISIBLE_BARS, to: to + RIGHT_OFFSET_BARS })
      } else {
        chart.timeScale().fitContent()
      }
      fittedKeyRef.current = fitKey
    }
  }, [candles, spec.intraday, precision, axisReference, symbol, timeframe, attempt])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !candles) return
    if (volumeShown) {
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
        candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume ?? 0, color: `${c.close >= c.open ? up : down}55` }))
      )
    } else if (volumeRef.current) {
      chart.removeSeries(volumeRef.current)
      volumeRef.current = null
    }
  }, [candles, volumeShown])

  // Márgenes de la escala de precio: arriba se abre hueco para las etiquetas de los pivotes
  // (hasta 7 apiladas) y abajo para la franja de volumen, que antes se montaba sobre las velas
  useEffect(() => {
    chartRef.current?.priceScale('right').applyOptions({
      scaleMargins: { top: levelsShown ? 0.14 : 0.1, bottom: volumeShown ? 0.2 : 0.08 },
    })
  }, [levelsShown, volumeShown])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    for (const indicator of INDICATORS) {
      const existing = lineRefs.current.get(indicator.key)
      const points = overlayPoints.get(indicator.key)
      if (!points) {
        if (existing && !overlays.includes(indicator.key)) {
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
      series.setData(points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value })))
    }
  }, [overlayPoints, overlays])

  // Oscillators live in their own panes below the price, never overlaid on it. Each pane is
  // created once and re-fed like the overlays; removing a pane's last series makes the library
  // drop the now-empty pane on its own, so there is no removePane bookkeeping. They only
  // recompute on a fresh candle fetch, never on the live-tick effect.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const activeOscillators = new Set(oscillators)
    for (const [oscKey, entry] of oscillatorRefs.current) {
      if (activeOscillators.has(oscKey)) continue
      for (const series of entry.series) chart.removeSeries(series)
      oscillatorRefs.current.delete(oscKey)
    }

    for (const oscillator of OSCILLATORS) {
      if (!activeOscillators.has(oscillator.key)) continue
      let entry = oscillatorRefs.current.get(oscillator.key)
      if (!entry) {
        const pane = chart.addPane()
        // Canonical stack order (RSI above MACD) regardless of which switch was flipped first.
        // paneIndex() is read after addPane (never a stale count) so moveTo can't outrun the model.
        const order = OSCILLATORS.filter((item) => activeOscillators.has(item.key)).map((item) => item.key)
        const target = 1 + order.indexOf(oscillator.key)
        if (pane.paneIndex() !== target) pane.moveTo(target)

        const lineOptions: SeriesPartialOptionsMap['Line'] = {
          color: oscillator.color,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          priceFormat: { type: 'custom', formatter: macdAxisFormatter, minMove: 0.0001 },
        }

        if (oscillator.key === 'rsi') {
          const rsiSeries = pane.addSeries(LineSeries, {
            ...lineOptions,
            priceFormat: { type: 'price', precision: 1, minMove: 0.1 },
            // The index is only meaningful inside its band: the pane never zooms past 0..100
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
          })
          // Guide levels: the zone boundaries a trader glances at. hairline-soft se perdía contra
          // el fondo; ink-subtle punteado se lee sin competir con la línea
          for (const boundary of [30, 70]) {
            rsiSeries.createPriceLine({
              price: boundary,
              color: cssVar('--ink-subtle', '#808080'),
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              axisLabelVisible: false,
              title: '',
            })
          }
          entry = { pane, series: [rsiSeries] }
        } else {
          const histogramSeries = pane.addSeries(HistogramSeries, {
            priceLineVisible: false,
            lastValueVisible: false,
            priceFormat: { type: 'custom', formatter: macdAxisFormatter, minMove: 0.0001 },
          })
          const macdSeries = pane.addSeries(LineSeries, lineOptions)
          const signalSeries = pane.addSeries(LineSeries, { ...lineOptions, color: MACD_SIGNAL_COLOR })
          entry = { pane, series: [histogramSeries, macdSeries, signalSeries] }
        }
        oscillatorRefs.current.set(oscillator.key, entry)
      }

      const toSeries = (points: LinePoint[]) => points.map((point) => ({ time: point.time as UTCTimestamp, value: point.value }))
      if (oscillator.key === 'rsi' && oscillatorPoints?.rsi) {
        ;(entry.series[0] as ISeriesApi<'Line'>).setData(toSeries(oscillatorPoints.rsi))
      } else if (oscillator.key === 'macd' && oscillatorPoints?.macd) {
        const [histogramSeries, macdSeries, signalSeries] = entry.series as [ISeriesApi<'Histogram'>, ISeriesApi<'Line'>, ISeriesApi<'Line'>]
        const up = cssVar('--semantic-success', '#22c55e')
        const down = cssVar('--semantic-danger', '#ff3b30')
        histogramSeries.setData(
          oscillatorPoints.macd.histogram.map((point) => ({ time: point.time as UTCTimestamp, value: point.value, color: `${point.value >= 0 ? up : down}55` }))
        )
        macdSeries.setData(toSeries(oscillatorPoints.macd.macd))
        signalSeries.setData(toSeries(oscillatorPoints.macd.signal))
      }
    }

    // Pane heights are shared out of the chart's fixed height. Stretch factors (not setHeight)
    // keep each oscillator near OSCILLATOR_PANE_HEIGHT and leave the rest to the price pane, and
    // they are deterministic even when several panes change in the same tick.
    if (oscillatorRefs.current.size > 0) {
      chart.panes()[0].setStretchFactor(Math.max(height - oscillatorRefs.current.size * OSCILLATOR_PANE_HEIGHT, OSCILLATOR_PANE_HEIGHT * 2))
      for (const [, entry] of oscillatorRefs.current) entry.pane.setStretchFactor(OSCILLATOR_PANE_HEIGHT)
    }
  }, [oscillatorPoints, oscillators, height])

  // Tick en vivo sobre la última barra: update() en vez de setData() para no mover la escala de
  // tiempo ni re-encajar la vista cada pico. Va después del effect de las velas porque ese
  // reescribe la base sin tick; con liveClose ausente displayCandles es la base y la barra vuelve
  // a los candles sin tick.
  useEffect(() => {
    const series = candleRef.current
    if (!series || !displayCandles || loading) return
    const last = displayCandles[displayCandles.length - 1]
    if (!last) return
    series.update({ time: last.time as UTCTimestamp, open: last.open, high: last.high, low: last.low, close: last.close })
  }, [displayCandles, loading, precision, axisReference])

  // Horizontal levels. Son pivotes diarios: en 1W/1M quedan comprimidos en una franja de pocos
  // píxeles y sus 7 etiquetas tapaban la escala, así que solo se dibujan hasta 1D
  useEffect(() => {
    const series = candleRef.current
    if (!series) return

    // Diff instead of rebuild: a pivot refetch (or a caller that re-creates the array every render)
    // used to remove and re-add every line, repainting the whole plot for lines that never changed.
    // Only the lines that disappeared, moved or changed color are touched; the rest keep their identity.
    const lines = priceLinesRef.current
    const wanted = new Map<string, ChartLevel>()
    if (levelsShown) {
      for (const level of levels) {
        if (level.price > 0) wanted.set(level.title, level)
      }
    }

    for (const [title, line] of lines) {
      const level = wanted.get(title)
      const options = line.options()
      if (!level || level.price !== options.price || level.color !== options.color) {
        series.removePriceLine(line)
        lines.delete(title)
      }
    }

    for (const [title, level] of wanted) {
      const existing = lines.get(title)
      if (existing) {
        existing.applyOptions({ price: level.price, color: level.color })
        continue
      }
      lines.set(
        title,
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
  }, [levels, levelsShown])

  // Close the indicator menu on outside click or Escape. Escape also hands focus back to the button
  // that opened it, so a keyboard user is never dropped at the top of the document
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  // Menus open focused on their first item; the roving tabindex follows whatever is focused.
  // El índice de foco se reinicia en el toggle (al abrir), no aquí: setState dentro del effect
  // provoca un render en cascada y React lo prohíbe
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus()
  }, [menuOpen])

  const toggleMenu = useCallback(() => {
    setMenuOpen((value) => !value)
    setMenuFocusIndex(0)
  }, [])

  // Pantalla completa sobre el propio contenedor del gráfico: el lienzo ocupa la ventana
  // y autoSize lo rellena, sin tocar el resto del componente. Aquí solo se pide el cambio;
  // cualquier salida (Esc del sistema, F11, permiso denegado) llega por fullscreenchange,
  // que es el que manda sobre el estado.
  const toggleFullscreen = useCallback(() => {
    const target = containerRef.current
    if (!target) return
    try {
      if (document.fullscreenElement === target) {
        void document.exitFullscreen().catch(() => {})
      } else {
        void target.requestFullscreen().catch(() => {})
      }
    } catch {
      // Sin API de fullscreen el botón queda inerte; nunca rompe la página
    }
  }, [])

  const exportPng = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    const fail = () => setExportError(dict.marketChart.exportFailed)
    setExportError(null)
    try {
      // takeScreenshot(addTopLayer = false, includeCrosshair = false): lienzo del gráfico ya
      // pintado, con la escala dibujada y el crosshair oculto (se restaura al salir)
      const shot = chart.takeScreenshot()
      // El layout del gráfico es transparente: sin fondo el PNG se abriría ilegible en un
      // visor claro, así que se compone sobre el mismo fondo de la tarjeta
      const image = document.createElement('canvas')
      image.width = shot.width
      image.height = shot.height
      const context = image.getContext('2d')
      if (!context) throw new Error('no 2d context')
      context.fillStyle = cssVar('--surface-container-lowest', '#0e0e0e')
      context.fillRect(0, 0, image.width, image.height)
      context.drawImage(shot, 0, 0)
      image.toBlob((blob) => {
        if (!blob) return fail()
        try {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `${symbol.replace(/[^\w.-]+/g, '-')}-${timeframe}.png`
          document.body.appendChild(link)
          link.click()
          link.remove()
          // Revocar en el mismo tick cancela la descarga en algunos navegadores
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch {
          fail()
        }
      }, 'image/png')
    } catch {
      // canvas agotado, página en background…: aviso discreto por aria-live, sin excepción
      fail()
    }
  }, [dict.marketChart.exportFailed, symbol, timeframe])

  const toggleOverlay = useCallback((overlay: Overlay) => {
    setOverlays((current) => (current.includes(overlay) ? current.filter((item) => item !== overlay) : [...current, overlay]))
  }, [])

  const toggleOscillator = useCallback((oscillator: OscillatorKey) => {
    setOscillators((current) => (current.includes(oscillator) ? current.filter((item) => item !== oscillator) : [...current, oscillator]))
  }, [])

  // ↑/↓ walk the menu items (disabled ones are skipped: they can't take focus); Tab closes the menu
  // and lets focus carry on to whatever follows, as in any ARIA menu
  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      setMenuOpen(false)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLInputElement>('input:not(:disabled)') ?? [])
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLInputElement)
    const offset = event.key === 'ArrowDown' ? 1 : -1
    const next = current === -1 ? (offset > 0 ? items[0] : items[items.length - 1]) : items[(current + offset + items.length) % items.length]
    event.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest' })
  }

  // ←/→ (y Home/End) recorren la fila de temporalidades; Enter/Space ya activan cada opción
  // porque es un <button> de verdad. El orden de tabulación es de roving: solo el activo
  // está en el tab, así que de un grupo de ocho botones se salta con las flechas en vez de
  // ocho veces con Tab.
  function onTimeframeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return
    event.preventDefault()
    let next = current
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    else next = (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  // The legend follows the crosshair and rests on the latest candle (tick-adjusted when there is live data)
  const lastCandle = displayCandles?.length ? displayCandles[displayCandles.length - 1] : null
  const hovered = hoverTime !== null ? candleByTime.get(hoverTime) : undefined
  const shown = hovered?.candle ?? lastCandle
  const previousClose = hovered ? hovered.previousClose : candles && candles.length > 1 ? candles[candles.length - 2].close : null
  const changePct = shown && previousClose ? ((shown.close - previousClose) / previousClose) * 100 : null
  const reference = axisReference ?? shown?.close ?? 1
  const legendTime = shown?.time ?? null
  const indicatorValue = (indicatorKey: IndicatorKey | OscillatorKey): string | null => {
    const value = legendTime !== null ? legendValues.get(indicatorKey)?.get(legendTime) : undefined
    if (value === undefined) return null
    if (indicatorKey === 'rsi') return value.toFixed(1)
    if (indicatorKey === 'macd') return macdAxisFormatter(value)
    return formatLevel(value, reference, symbol)
  }
  const emptyMessage =
    state && state.key === key && state.status !== 'ready'
      ? state.status === 'error'
        ? dict.marketChart.loadFailed
        : state.reason === 'asset'
          ? dict.marketChart.noDataForAsset
          : dict.marketChart.noDataForTimeframe
      : null
  const activeIndicators = [
    ...INDICATORS.filter((indicator) => overlays.includes(indicator.key)),
    ...OSCILLATORS.filter((oscillator) => oscillators.includes(oscillator.key)),
  ]

  return (
    <section
      className={clsx('flex flex-col', !bare && 'rounded-panel border border-hairline bg-surface-container-lowest')}
      aria-label={t(dict.marketChart.chartAria, { name })}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline-soft px-3 py-2">
        <div role="group" aria-label={dict.marketChart.timeframeAria} className="flex items-center gap-0.5" onKeyDown={onTimeframeKeyDown}>
          {TIMEFRAME_KEYS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={timeframe === option}
              tabIndex={timeframe === option ? 0 : -1}
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
              aria-pressed={levelsAllowed && levelsOn}
              disabled={!levelsAllowed}
              title={levelsAllowed ? undefined : dict.marketChart.pivotsDailyOnly}
              onClick={() => setLevelsOn((value) => !value)}
              className={clsx(
                'h-7 rounded-sm px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent',
                levelsAllowed && levelsOn ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-1 hover:text-ink'
              )}
            >
              {resolvedLevelsLabel}
            </button>
          )}

          <div ref={menuRef} className="relative">
            <button
              type="button"
              ref={menuButtonRef}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={toggleMenu}
              className="flex h-7 items-center gap-1 rounded-sm px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              {dict.marketChart.indicatorsLabel}
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                expand_more
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label={dict.marketChart.indicatorsLabel}
                onKeyDown={onMenuKeyDown}
                className="absolute right-0 top-9 z-20 w-56 rounded-sm border border-hairline bg-surface-container-low p-1 shadow-xl"
              >
                <div role="group" aria-label={dict.marketChart.overlaysGroup}>
                  <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle" aria-hidden="true">
                    {dict.marketChart.overlaysGroup}
                  </p>
                  {INDICATORS.map((indicator, index) => (
                    <label key={indicator.key} className="flex cursor-pointer items-center gap-2.5 rounded-ctl px-2.5 py-2 text-[13px] text-ink hover:bg-surface-2">
                      <input
                        type="checkbox"
                        role="menuitemcheckbox"
                        aria-checked={overlays.includes(indicator.key)}
                        checked={overlays.includes(indicator.key)}
                        tabIndex={index === menuFocusIndex ? 0 : -1}
                        onFocus={() => setMenuFocusIndex(index)}
                        onChange={() => toggleOverlay(indicator.key)}
                        className="size-3.5 accent-[var(--accent-blue)]"
                      />
                      <span className="size-2 rounded-full" style={{ backgroundColor: indicator.color }} aria-hidden="true" />
                      {dict.indicators[indicator.key]}
                    </label>
                  ))}
                  {/* An asset without volume reads as off and disabled, never as a checked box that
                      refuses to toggle — that is what looked broken */}
                  <label
                    className={clsx(
                      'flex items-center gap-2.5 rounded-ctl px-2.5 py-2 text-[13px]',
                      hasVolume ? 'cursor-pointer text-ink hover:bg-surface-2' : 'cursor-not-allowed text-ink-subtle'
                    )}
                    title={hasVolume ? undefined : dict.marketChart.noVolumeTooltip}
                  >
                    <input
                      type="checkbox"
                      role="menuitemcheckbox"
                      aria-checked={hasVolume && overlays.includes('volume')}
                      checked={hasVolume && overlays.includes('volume')}
                      tabIndex={INDICATORS.length === menuFocusIndex ? 0 : -1}
                      onFocus={() => setMenuFocusIndex(INDICATORS.length)}
                      onChange={() => toggleOverlay('volume')}
                      disabled={!hasVolume}
                      title={hasVolume ? undefined : dict.marketChart.noVolumeTooltip}
                      className="size-3.5 accent-[var(--accent-blue)]"
                    />
                    <span className="size-2 rounded-full bg-ink-subtle" aria-hidden="true" />
                    {dict.marketChart.volumeLabel}
                  </label>
                </div>
                <div role="group" aria-label={dict.marketChart.oscillatorsGroup} className="mt-1 border-t border-hairline-soft pt-1">
                  <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle" aria-hidden="true">
                    {dict.marketChart.oscillatorsGroup}
                  </p>
                  {OSCILLATORS.map((oscillator, index) => (
                    <label key={oscillator.key} className="flex cursor-pointer items-center gap-2.5 rounded-ctl px-2.5 py-2 text-[13px] text-ink hover:bg-surface-2">
                      <input
                        type="checkbox"
                        role="menuitemcheckbox"
                        aria-checked={oscillators.includes(oscillator.key)}
                        checked={oscillators.includes(oscillator.key)}
                        tabIndex={INDICATORS.length + 1 + index === menuFocusIndex ? 0 : -1}
                        onFocus={() => setMenuFocusIndex(INDICATORS.length + 1 + index)}
                        onChange={() => toggleOscillator(oscillator.key)}
                        className="size-3.5 accent-[var(--accent-blue)]"
                      />
                      <span className="size-2 rounded-full" style={{ backgroundColor: oscillator.color }} aria-hidden="true" />
                      {dict.indicators[oscillator.key]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            ref={fullscreenButtonRef}
            onClick={toggleFullscreen}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? dict.marketChart.fullscreenExit : dict.marketChart.fullscreenEnter}
            className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted transition-colors motion-reduce:transition-none hover:bg-surface-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {fullscreen ? 'close' : 'open_in_new'}
            </span>
          </button>

          <button
            type="button"
            onClick={exportPng}
            aria-label={dict.marketChart.exportPng}
            className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted transition-colors motion-reduce:transition-none hover:bg-surface-1 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              ios_share
            </span>
          </button>
        </div>
      </div>

      <div className="relative" style={{ height }}>
        {/* El contenedor es lo que se pone a pantalla completa (autoSize solo lo observa a él),
            así que todo lo que se pinta sobre el gráfico vive dentro: si no, la leyenda y los
            estados se quedarían en la página y no se verían en pantalla completa. Sus z-index
            (10 y 30) siguen por encima de los lienzos de la librería, numerados 1 y 2. El
            fondo solo se pinta a pantalla completa: ahí la tarjeta desaparece y el lienzo
            transparente se apoyaría en el negro del navegador */}
        <div ref={containerRef} className={clsx('absolute inset-0', fullscreen && 'bg-surface-container-lowest')}>
          {/* El botón de salida no puede vivir en la barra: la barra queda fuera de la pantalla
              completa. Su gemelo de la barra cambia de icono igual, para que los dos digan lo
              mismo en cualquier estado */}
          {fullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={dict.marketChart.fullscreenExit}
              className="absolute right-3 top-3 z-30 grid size-8 place-items-center rounded-ctl border border-hairline bg-surface-container-low/90 text-ink-muted shadow-lg transition-colors motion-reduce:transition-none hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                close
              </span>
            </button>
          )}

          {/* La leyenda lleva su propio fondo: sin él, las líneas de los pivotes y las medias
              cruzaban el texto y lo dejaban ilegible */}
          {shown && !loading && (
            <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-5.5rem)] flex-col items-start gap-1">
              <div className="flex w-fit flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-ctl bg-surface-container-lowest/85 px-1.5 py-0.5 text-[11px] tabular-nums text-ink-muted sm:text-[12px]">
                <span className="font-medium text-ink">{name}</span>
                {live && (
                  <span className={live.changeAbs == null ? 'text-ink' : live.changeAbs >= 0 ? 'text-semantic-success' : 'text-semantic-danger'}>
                    {dict.marketChart.livePriceLabel} {formatLevel(live.close, reference, symbol)}
                  </span>
                )}
                <span className="hidden sm:inline">
                  {dict.marketChart.ohlcOpen} <span className="text-ink">{formatLevel(shown.open, reference, symbol)}</span>
                </span>
                <span className="hidden sm:inline">
                  {dict.marketChart.ohlcHigh} <span className="text-ink">{formatLevel(shown.high, reference, symbol)}</span>
                </span>
                <span className="hidden sm:inline">
                  {dict.marketChart.ohlcLow} <span className="text-ink">{formatLevel(shown.low, reference, symbol)}</span>
                </span>
                <span>
                  {dict.marketChart.ohlcClose} <span className="text-ink">{formatLevel(shown.close, reference, symbol)}</span>
                </span>
                {changePct !== null && <span className={changePct >= 0 ? 'text-semantic-success' : 'text-semantic-danger'}>{signed(changePct)}</span>}
                {shown.volume !== undefined && volumeShown && (
                  <span>
                    {dict.marketChart.ohlcVolume} <span className="text-ink">{formatCompact(shown.volume)}</span>
                  </span>
                )}
              </div>
              {activeIndicators.length > 0 && (
                <ul className="flex w-fit flex-wrap gap-x-3 gap-y-0.5 rounded-ctl bg-surface-container-lowest/85 px-1.5 py-0.5 text-[11px] tabular-nums text-ink-muted">
                  {activeIndicators.map((indicator) => {
                    const value = indicatorValue(indicator.key)
                    return (
                      <li key={indicator.key} className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: indicator.color }} aria-hidden="true" />
                        {dict.indicators[indicator.key]}
                        {value !== null && <span className="text-ink">{value}</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" role="status">
              <span className="flex items-center gap-2 rounded-ctl bg-surface-container-lowest/85 px-2.5 py-1.5 text-[13px] text-ink-muted">
                <span className="size-1.5 animate-pulse rounded-full bg-accent-blue motion-reduce:animate-none" aria-hidden="true" />
                {t(dict.marketChart.loadingTimeframe, { timeframe: TIMEFRAMES[timeframe].label })}
              </span>
            </div>
          )}

          {!loading && state && emptyMessage && state.status !== 'ready' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest px-8 text-center" role="alert">
              <span className="material-symbols-outlined text-[28px] text-ink-subtle" aria-hidden="true">
                {state.status === 'error' ? 'cloud_off' : 'candlestick_chart'}
              </span>
              <p className="max-w-sm text-[14px] font-medium text-ink">{emptyMessage}</p>
              {state.status === 'error' ? (
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="h-8 rounded-ctl border border-hairline px-3 text-[13px] font-medium text-ink transition-[background-color,transform] duration-150 ease-out hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent-blue active:scale-[0.97] motion-reduce:transition-none"
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
      </div>

      {/* Solo el fallo de exportación se anuncia: un aviso discreto para lectores de
          pantalla, sin toast ni diálogo que tape el gráfico */}
      <p className="sr-only" aria-live="polite">
        {exportError}
      </p>

      <p className="border-t border-hairline-soft px-3 py-2 text-[11px] text-ink-subtle" aria-live="polite">
        {state?.status === 'ready' && state.stale ? dict.marketChart.staleData : dict.marketChart.sourceNote}
      </p>
    </section>
  )
}

// Los futuros sin velas Yahoo (PLAN-FUTUROS.md, D2) no pueden alimentar este gráfico: usan el
// widget de TradingView, sin la barra de temporalidades, indicadores ni pivotes propios. La
// decisión vive en este wrapper (no dentro del canvas) porque el canvas tiene hooks de sobra.
export function MarketChart({ allowWidget = true, ...props }: MarketChartProps) {
  if (allowWidget && usesTradingViewChart(props.symbol)) {
    return <TradingViewWidget symbol={props.symbol} name={props.name} height={props.height} delayMinutes={props.delayMinutes} />
  }
  return <MarketChartCanvas {...props} />
}
