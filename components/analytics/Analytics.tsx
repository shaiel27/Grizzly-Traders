'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import {
  CLAVE_CONSENTIMIENTO,
  CLAVE_CONSENTIMIENTO_PUBLICIDAD,
  EVENTO_ABRIR_PREFERENCIAS,
  EVENTO_CONSENTIMIENTO,
  comandosDeInicio,
  esCookieDeGoogleAnalytics,
  esIdMedicion,
  hayQuePreguntar,
  nombresDeCookies,
  type Consentimiento,
} from '@/lib/analytics'
import { guardarDecision, useEstadoAnalitica, useEstadoPublicidad } from './consentimiento'

// Aviso de cookies (analítica y publicidad, cada una con su decisión) + Google Analytics 4 con consentimiento previo.
// Sin ID de medición válido y sin publicidad activa no renderiza nada. Ver docs/analitica.md y docs/publicidad.md.

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    [clave: `ga-disable-${string}`]: boolean | undefined
  }
}

function borrarCookiesDeGoogle() {
  const host = window.location.hostname
  const dominios = [undefined, host, '.' + host.replace(/^www\./, '')]
  for (const nombre of nombresDeCookies(document.cookie).filter(esCookieDeGoogleAnalytics)) {
    for (const dominio of dominios) {
      document.cookie = `${nombre}=; Max-Age=0; path=/${dominio ? `; domain=${dominio}` : ''}`
    }
  }
}

interface Props {
  measurementId?: string
  // Interruptor de la publicidad (NEXT_PUBLIC_ADS_ACTIVO). Apagado: el aviso solo habla de analítica, como antes.
  publicidadActiva?: boolean
}

export function Analytics({ measurementId, publicidadActiva = false }: Props) {
  const id = esIdMedicion(measurementId) ? measurementId : null
  if (!id && !publicidadActiva) return null
  return <AvisoYAnalitica id={id} publicidadActiva={publicidadActiva} />
}

function AvisoYAnalitica({ id, publicidadActiva }: { id: string | null; publicidadActiva: boolean }) {
  const dict = useDictionary().cookieConsent
  const pathname = usePathname()
  const estadoAnalitica = useEstadoAnalitica()
  const estadoPublicidad = useEstadoPublicidad()
  const [reabierto, setReabierto] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  const [seleccion, setSeleccion] = useState({ analitica: false, publicidad: false })
  const iniciado = useRef(false)

  useEffect(() => {
    const abrir = () => {
      // Al reabrir desde el pie, la selección parte de lo decidido
      setSeleccion({ analitica: estadoAnalitica === 'concedido', publicidad: estadoPublicidad === 'concedido' })
      setReabierto(true)
    }
    window.addEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir)
  }, [estadoAnalitica, estadoPublicidad])

  // Con consentimiento: se prepara gtag (la cola funciona aunque la librería aún no haya cargado) y se envía una vista por ruta
  useEffect(() => {
    if (!id || estadoAnalitica !== 'concedido') return
    window[`ga-disable-${id}`] = false
    window.dataLayer = window.dataLayer || []
    window.gtag =
      window.gtag ||
      function gtag() {
        // gtag exige `arguments`, no un array
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments)
      }
    if (!iniciado.current) {
      iniciado.current = true
      for (const [comando, ...resto] of comandosDeInicio(id)) window.gtag(comando, ...(comando === 'js' ? [new Date()] : resto))
    }
    window.gtag('event', 'page_view', { page_path: pathname, page_location: window.location.href, page_title: document.title })
  }, [estadoAnalitica, id, pathname])

  // Rechazo (o retirada del consentimiento): se apaga la medición y se borran las cookies que dejó Google
  useEffect(() => {
    if (!id || estadoAnalitica !== 'denegado') return
    window[`ga-disable-${id}`] = true
    iniciado.current = false
    borrarCookiesDeGoogle()
  }, [estadoAnalitica, id])

  function cerrar() {
    window.dispatchEvent(new Event(EVENTO_CONSENTIMIENTO))
    setReabierto(false)
    setEligiendo(false)
  }

  function decidir(analitica: Consentimiento, publicidad: Consentimiento) {
    if (id) guardarDecision(CLAVE_CONSENTIMIENTO, analitica)
    if (publicidadActiva) guardarDecision(CLAVE_CONSENTIMIENTO_PUBLICIDAD, publicidad)
    cerrar()
  }
  const valor = (activada: boolean): Consentimiento => (activada ? 'concedido' : 'denegado')

  const servidor = estadoAnalitica === 'servidor' || estadoPublicidad === 'servidor'
  const pregunta =
    !servidor &&
    hayQuePreguntar(
      { analitica: id !== null, publicidad: publicidadActiva },
      { analitica: estadoAnalitica as Consentimiento | 'pendiente', publicidad: estadoPublicidad as Consentimiento | 'pendiente' }
    )
  const visible = pregunta || (reabierto && !servidor)

  const claseBoton =
    'rounded-lg border border-hairline px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue'
  const cuerpo = publicidadActiva ? (id ? dict.bodyAds : dict.catAdsDesc) : dict.body

  const categorias = [
    ...(id ? [{ clave: 'analitica' as const, titulo: dict.catAnalytics, detalle: dict.catAnalyticsDesc }] : []),
    ...(publicidadActiva ? [{ clave: 'publicidad' as const, titulo: dict.catAds, detalle: dict.catAdsDesc }] : []),
  ]

  return (
    <>
      {id && estadoAnalitica === 'concedido' && <Script id="ga-biblioteca" src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />}
      {visible && (
        <section
          role="region"
          aria-label={dict.region}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border border-hairline bg-surface-1 p-5 text-ink shadow-2xl sm:left-auto sm:right-4 sm:mx-0"
        >
          <h2 className="text-base font-bold">{dict.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {cuerpo}{' '}
            <Link href="/legal/cookies" className="underline underline-offset-2 hover:text-ink">
              {dict.policy}
            </Link>
          </p>

          {publicidadActiva && eligiendo && (
            <div className="mt-4 space-y-3">
              {categorias.map((c) => (
                <label key={c.clave} className="flex cursor-pointer items-start gap-3 rounded-xl border border-hairline p-3">
                  <input
                    type="checkbox"
                    checked={seleccion[c.clave]}
                    onChange={(e) => setSeleccion((s) => ({ ...s, [c.clave]: e.target.checked }))}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent-blue)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{c.titulo}</span>
                    <span className="block text-[13px] leading-relaxed text-ink-muted">{c.detalle}</span>
                  </span>
                </label>
              ))}
              <p className="text-[12px] leading-relaxed text-ink-muted">{dict.adsNote}</p>
            </div>
          )}

          {/* Aceptar y Rechazar con el mismo peso visual: rechazar no puede ser la opción escondida */}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {publicidadActiva ? (
              <>
                {eligiendo ? (
                  <button type="button" onClick={() => decidir(valor(seleccion.analitica), valor(seleccion.publicidad))} className={claseBoton}>
                    {dict.saveSelection}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSeleccion({ analitica: estadoAnalitica === 'concedido', publicidad: estadoPublicidad === 'concedido' })
                      setEligiendo(true)
                    }}
                    className={claseBoton}
                  >
                    {dict.customize}
                  </button>
                )}
                <button type="button" onClick={() => decidir('denegado', 'denegado')} className={claseBoton}>
                  {dict.rejectAll}
                </button>
                <button type="button" onClick={() => decidir('concedido', 'concedido')} className={claseBoton}>
                  {dict.acceptAll}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => decidir('denegado', 'denegado')} className={claseBoton}>
                  {dict.reject}
                </button>
                <button type="button" onClick={() => decidir('concedido', 'concedido')} className={claseBoton}>
                  {dict.accept}
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </>
  )
}
