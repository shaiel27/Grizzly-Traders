'use client'

import { useEffect, useRef, useState } from 'react'
import { puedeMostrarAnuncios } from '@/lib/analytics'
import { ESPACIOS, PUBLICIDAD_ACTIVA, urlDelAnuncio, type Espacio } from '@/lib/publicidad'
import { useEstadoPublicidad } from '@/components/analytics/consentimiento'

// Un espacio de publicidad de Adsterra. No se pinta NADA (ni el rótulo) salvo que se cumplan todas estas condiciones:
//   1. la publicidad está activada en el sitio (NEXT_PUBLIC_ADS_ACTIVO=true),
//   2. el espacio existe y está bien configurado (NEXT_PUBLIC_ADS_SLOTS),
//   3. el visitante aceptó la publicidad.
// El código del anuncio se carga solo cuando el espacio se acerca a la pantalla, con la altura reservada para no mover el contenido.
// Reglas de Adsterra: su código no va en un iframe nuestro ni se modifica (cláusula 4.7), y no se hace clic en los propios anuncios.
// Ver docs/publicidad.md.

declare global {
  interface Window {
    atOptions?: unknown
  }
}

// Los banners de Adsterra leen una variable global (`atOptions`) al ejecutarse: si dos se cargan a la vez, se pisan.
// Por eso se cargan de uno en uno.
let cola: Promise<void> = Promise.resolve()

function cargar(contenedor: HTMLElement, espacio: Espacio): Promise<void> {
  cola = cola.then(
    () =>
      new Promise<void>((resolve) => {
        if (!contenedor.isConnected) return resolve()
        const script = document.createElement('script')
        script.async = true
        script.setAttribute('data-cfasync', 'false')
        script.src = urlDelAnuncio(espacio)
        if (espacio.tipo === 'banner') {
          window.atOptions = { key: espacio.clave, format: 'iframe', height: espacio.alto, width: espacio.ancho, params: {} }
        } else {
          contenedor.id = `container-${espacio.clave}`
        }
        const seguir = () => resolve()
        script.onload = seguir
        script.onerror = seguir
        window.setTimeout(seguir, 8000) // un anuncio que no responde no debe bloquear a los demás
        contenedor.appendChild(script)
      })
  )
  return cola
}

interface AdSlotProps {
  nombre: string
  etiqueta?: string
  className?: string
  // Dentro de una lista (<ul>): se envuelve en un <li> que ocupa toda la fila de la rejilla. Si no se muestra, no deja ni el <li>.
  enLista?: boolean
}

// ¿Hay algo visible además del propio <script> que cargamos? (el anuncio puede ser un iframe, una imagen o un bloque de texto)
export function hayAnuncio(contenedor: HTMLElement): boolean {
  return Array.from(contenedor.children).some((n) => n.tagName !== 'SCRIPT')
}

export function AdSlot({ nombre, etiqueta = 'Publicidad', className, enLista = false }: AdSlotProps) {
  const espacio = ESPACIOS[nombre]
  const estado = useEstadoPublicidad()
  const contenedor = useRef<HTMLDivElement>(null)
  const [cerca, setCerca] = useState(false)
  // Sin anuncio (bloqueador, sin oferta, fallo de red): el espacio se esconde en vez de dejar una caja vacía con la etiqueta «Publicidad». Sigue montado: si el anuncio llega tarde, reaparece
  const [vacio, setVacio] = useState(false)
  const mostrar = PUBLICIDAD_ACTIVA && espacio !== undefined && puedeMostrarAnuncios(true, estado)

  // Carga perezosa: solo cuando el espacio está a ~300 px de la pantalla
  useEffect(() => {
    if (!mostrar || !contenedor.current) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setCerca(true)
          observador.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    observador.observe(contenedor.current)
    return () => observador.disconnect()
  }, [mostrar])

  useEffect(() => {
    const el = contenedor.current
    if (!mostrar || !cerca || !el) return
    let activo = true
    let espera: number | undefined
    let intento = 0
    // El anuncio puede llegar tarde (petición lenta, red congestionada): se vigila el contenedor y, si aparece algo, el espacio se vuelve a mostrar
    const vigilante = new MutationObserver(() => {
      if (activo && hayAnuncio(el)) setVacio(false)
    })
    vigilante.observe(el, { childList: true })
    const lanzar = () => {
      void cargar(el, espacio).then(() => {
        // Margen para que se pinte; si no hay anuncio se reintenta UNA vez (un fallo de red o un 503 puntual de Adsterra) y, si sigue sin haberlo, se esconde
        espera = window.setTimeout(() => {
          if (!activo || hayAnuncio(el)) return
          if (intento === 0) {
            intento = 1
            el.replaceChildren()
            lanzar()
          } else {
            setVacio(true)
          }
        }, 8000)
      })
    }
    lanzar()
    // Al retirar el consentimiento o cambiar de página, el anuncio se quita
    return () => {
      activo = false
      vigilante.disconnect()
      window.clearTimeout(espera)
      el.replaceChildren()
      el.removeAttribute('id')
    }
  }, [mostrar, cerca, espacio])

  if (!mostrar) return null
  const anuncio = (
    <aside aria-label={etiqueta} hidden={vacio} className={className ?? (enLista ? '' : 'my-8 max-w-[68ch]')}>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">{etiqueta}</p>
      {/* Altura reservada: el anuncio al cargar no desplaza lo que hay debajo */}
      <div ref={contenedor} style={{ minHeight: espacio.tipo === 'banner' ? espacio.alto : 250 }} className="flex justify-center overflow-hidden rounded-lg border border-hairline-soft bg-surface-1" />
    </aside>
  )
  return enLista ? <li className={vacio ? 'hidden' : 'col-span-full'}>{anuncio}</li> : anuncio
}
