'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDictionary } from '@/lib/i18n/LocaleProvider'
import {
  CLAVE_CONSENTIMIENTO,
  EVENTO_ABRIR_PREFERENCIAS,
  EVENTO_CONSENTIMIENTO,
  comandosDeInicio,
  esCookieDeGoogleAnalytics,
  esIdMedicion,
  leerConsentimiento,
  nombresDeCookies,
  type Consentimiento,
} from '@/lib/analytics'

// Google Analytics 4 con consentimiento previo + el aviso para pedirlo. Sin ID de medición válido no renderiza nada.
// Ver docs/analitica.md.

type Estado = Consentimiento | 'pendiente' | 'servidor'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    [clave: `ga-disable-${string}`]: boolean | undefined
  }
  interface Navigator {
    globalPrivacyControl?: boolean
  }
}

function suscribir(avisar: () => void) {
  window.addEventListener('storage', avisar)
  window.addEventListener(EVENTO_CONSENTIMIENTO, avisar)
  return () => {
    window.removeEventListener('storage', avisar)
    window.removeEventListener(EVENTO_CONSENTIMIENTO, avisar)
  }
}

function leerEstado(): Estado {
  let guardado: string | null = null
  try {
    guardado = window.localStorage.getItem(CLAVE_CONSENTIMIENTO)
  } catch {
    // almacenamiento bloqueado: se comporta como "sin decisión" y no se carga nada
  }
  return leerConsentimiento(guardado, navigator.globalPrivacyControl === true) ?? 'pendiente'
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

export function Analytics({ measurementId }: { measurementId?: string }) {
  const id = esIdMedicion(measurementId) ? measurementId : null
  if (!id) return null
  return <AnalyticsActiva id={id} />
}

function AnalyticsActiva({ id }: { id: string }) {
  const dict = useDictionary().cookieConsent
  const pathname = usePathname()
  const estado = useSyncExternalStore<Estado>(suscribir, leerEstado, () => 'servidor')
  const [reabierto, setReabierto] = useState(false)
  const iniciado = useRef(false)

  useEffect(() => {
    const abrir = () => setReabierto(true)
    window.addEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_PREFERENCIAS, abrir)
  }, [])

  // Con consentimiento: se prepara gtag (la cola funciona aunque la librería aún no haya cargado) y se envía una vista por ruta
  useEffect(() => {
    if (estado !== 'concedido') return
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
  }, [estado, id, pathname])

  // Rechazo (o retirada del consentimiento): se apaga la medición y se borran las cookies que dejó Google
  useEffect(() => {
    if (estado !== 'denegado') return
    window[`ga-disable-${id}`] = true
    iniciado.current = false
    borrarCookiesDeGoogle()
  }, [estado, id])

  function decidir(valor: Consentimiento) {
    try {
      window.localStorage.setItem(CLAVE_CONSENTIMIENTO, valor)
    } catch {
      // sin almacenamiento no se puede recordar la decisión, pero se respeta en esta visita
    }
    window.dispatchEvent(new Event(EVENTO_CONSENTIMIENTO))
    setReabierto(false)
  }

  const visible = estado === 'pendiente' || (reabierto && estado !== 'servidor')
  const claseBoton =
    'rounded-lg border border-hairline px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue'

  return (
    <>
      {estado === 'concedido' && <Script id="ga-biblioteca" src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />}
      {visible && (
        <section
          role="region"
          aria-label={dict.region}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-2xl border border-hairline bg-surface-1 p-5 text-ink shadow-2xl sm:left-auto sm:right-4 sm:mx-0"
        >
          <h2 className="text-base font-bold">{dict.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {dict.body}{' '}
            <Link href="/legal/cookies" className="underline underline-offset-2 hover:text-ink">
              {dict.policy}
            </Link>
          </p>
          {/* Aceptar y Rechazar con el mismo peso visual: rechazar no puede ser la opción escondida */}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => decidir('denegado')} className={claseBoton}>
              {dict.reject}
            </button>
            <button type="button" onClick={() => decidir('concedido')} className={claseBoton}>
              {dict.accept}
            </button>
          </div>
        </section>
      )}
    </>
  )
}
