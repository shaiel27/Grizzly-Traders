'use client'

import { useEffect, useRef, useState } from 'react'
import { ASSET_BY_TV } from '@/lib/assets-catalog'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'

// Gráfico Advanced Chart de TradingView para los futuros que no tienen velas en Yahoo (PLAN-FUTUROS.md,
// D2 opción A: widget gratuito, el retraso del dato lo fija TradingView).
//
// Embed: el OFICIAL (https://www.tradingview.com/widget-docs/tutorials/iframe/build-page/widget-integration/):
// un <script src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"> cuyo
// contenido es el JSON de settings. El script crea su propio iframe dentro del contenedor. Requiere
// `script-src https://s3.tradingview.com` y `frame-src https://www.tradingview-widget.com` en la CSP
// (next.config.ts). Si el script no llega a crear el iframe y cargarlo a tiempo (bloqueado, red, CSP)
// se muestra un error con el enlace a TradingView en vez de un spinner infinito.
const SCRIPT_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
const LOAD_TIMEOUT_MS = 12_000
const COPYRIGHT_HREF = 'https://www.tradingview.com/'

// Un futuro usa el widget cuando el catálogo no tiene velas Yahoo para él. US02Y (índice sin velas)
// no entra: conserva su comportamiento actual.
export function usesTradingViewChart(tvSymbol: string): boolean {
  const asset = ASSET_BY_TV.get(tvSymbol)
  return asset?.cls === 'future' && asset.yahoo === undefined
}

interface TradingViewWidgetProps {
  // Ticker de TradingView del catálogo (p. ej. EUREX:FDAX1!)
  symbol: string
  name: string
  height?: number
  // Retraso medido en el scanner (null = tiempo real o desconocido); se rotula bajo el gráfico
  delayMinutes?: number | null
}

function Frame({ symbol, name, height, delayMinutes }: Required<Omit<TradingViewWidgetProps, 'delayMinutes'>> & { delayMinutes: number | null }) {
  const dict = useDictionary()
  const { locale } = useLocale()
  const hostRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  // Carga diferida: el script (y todo lo que TradingView descarga) no se pide hasta que el
  // contenedor está cerca de la pantalla
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let frameObserver: MutationObserver | undefined

    const iniciar = () => {
      const settings = {
        autosize: true,
        symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale,
        allow_symbol_change: false,
        calendar: false,
        support_host: 'https://www.tradingview.com',
      }
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onerror = () => setFailed(true)
      script.text = JSON.stringify(settings)
      // El script añade su propio contenedor + iframe como hermanos SIGUIENTES de si mismo: el host solo
      // lleva el script (un div vacio delante empujaria el iframe fuera del area visible)
      host.append(script)

      // El script inyecta el iframe en el contenedor: se espera su evento load
      const vigilar = () => {
        const frame = host.querySelector('iframe')
        if (!frame) return false
        frame.addEventListener('load', () => setLoaded(true), { once: true })
        return true
      }
      if (!vigilar()) {
        frameObserver = new MutationObserver(() => {
          if (vigilar()) frameObserver?.disconnect()
        })
        frameObserver.observe(host, { childList: true, subtree: true })
      }
      timer = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        iniciar()
      },
      { rootMargin: '200px' }
    )
    observer.observe(host)
    return () => {
      observer.disconnect()
      frameObserver?.disconnect()
      if (timer) clearTimeout(timer)
      // Sin iframes ni scripts huérfanos al cambiar de activo o desmontar
      host.replaceChildren()
    }
  }, [symbol, locale])

  // Cuando carga, el temporizador de error ya no aplica
  const showError = failed && !loaded
  const tvHref = `${COPYRIGHT_HREF}chart/?symbol=${encodeURIComponent(symbol)}`

  // Sin utm_source: leer `location` en el render rompería la hidratación si esto se pre-renderiza
  const campaignHref = `${COPYRIGHT_HREF}?utm_medium=widget_new&utm_campaign=advanced-chart`

  return (
    <div className="flex flex-col bg-[#131722]" style={{ height }}>
      <div className="relative min-h-0 flex-1" aria-busy={!loaded && !showError}>
        <div ref={hostRef} className="absolute inset-0" role="group" aria-label={t(dict.assetDetail.tvChartTitle, { name })} />
        {!loaded && !showError && (
          <div role="status" aria-live="polite" className="pointer-events-none absolute inset-0 flex animate-pulse items-center justify-center bg-surface-1 motion-reduce:animate-none">
            <span className="text-[13px] text-ink-muted">{dict.assetDetail.tvLoading}</span>
          </div>
        )}
        {showError && (
          <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center bg-surface-1 px-4 text-center">
            <a href={tvHref} target="_blank" rel="noopener nofollow" className="text-[13px] text-accent-blue hover:text-accent-blue-hover focus-visible:outline-2 focus-visible:outline-accent-blue">
              {dict.assetDetail.tvError}
            </a>
          </div>
        )}
      </div>

      {/* Atribución: obligatoria por los términos del widget. Fuera del iframe (nunca tapada ni
          recortada), a 13 px como mínimo. El enlace oficial no se sustituye, se suma el nuestro. */}
      <p className="flex min-h-8 flex-wrap items-center justify-center gap-x-4 gap-y-0 px-3 py-1 text-[13px] leading-6 text-ink-muted">
        <a href={campaignHref} target="_blank" rel="noopener nofollow" className="text-accent-blue hover:text-accent-blue-hover focus-visible:outline-2 focus-visible:outline-accent-blue">
          Track all markets on TradingView
        </a>
        <a href={COPYRIGHT_HREF} target="_blank" rel="noopener nofollow" className="hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-blue">
          {dict.assetDetail.tvAttribution}
        </a>
        {delayMinutes !== null && <span>{t(dict.marketAssetHeader.delayed, { min: delayMinutes })}</span>}
      </p>
    </div>
  )
}

export function TradingViewWidget({ symbol, name, height = 440, delayMinutes = null }: TradingViewWidgetProps) {
  // `key` por símbolo (y por idioma, que va en la URL): al cambiar de activo el iframe anterior se
  // desmonta entero, nunca quedan dos vivos ni el nuevo hereda el estado de carga del viejo
  const { locale } = useLocale()
  return <Frame key={`${symbol}|${locale}`} symbol={symbol} name={name} height={height} delayMinutes={delayMinutes} />
}
