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

export function AdSlot({ nombre, etiqueta = 'Publicidad', className }: { nombre: string; etiqueta?: string; className?: string }) {
  const espacio = ESPACIOS[nombre]
  const estado = useEstadoPublicidad()
  const contenedor = useRef<HTMLDivElement>(null)
  const [cerca, setCerca] = useState(false)
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
    void cargar(el, espacio)
    // Al retirar el consentimiento o cambiar de página, el anuncio se quita
    return () => {
      el.replaceChildren()
      el.removeAttribute('id')
    }
  }, [mostrar, cerca, espacio])

  if (!mostrar) return null
  return (
    <aside aria-label={etiqueta} className={className ?? 'my-8 max-w-[68ch]'}>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">{etiqueta}</p>
      {/* Altura reservada: el anuncio al cargar no desplaza lo que hay debajo */}
      <div ref={contenedor} style={{ minHeight: espacio.tipo === 'banner' ? espacio.alto : 250 }} className="flex justify-center overflow-hidden rounded-lg border border-hairline-soft bg-surface-1" />
    </aside>
  )
}
