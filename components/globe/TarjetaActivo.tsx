'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { clsx } from 'clsx'
import type { Marcador } from '@/lib/globe/marcadores'
import type { Locale } from '@/lib/i18n/get-dictionary'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export interface PosicionPin {
  x: number
  y: number
  visible: boolean
}

interface NoticiaActivo {
  titulo: string
  href: string
  sentimientoLabel: string
  sentimientoClase: string
  fecha: string
}

// Cache de promesas a nivel de modulo (no de componente): abrir la misma tarjeta dos veces, o
// precargar al pasar el mouse y despues tocar el pin, no repite el pedido — son 3 titulares
// publicos, nada sensible que requiera invalidarse por usuario.
const cacheNoticias = new Map<string, Promise<NoticiaActivo[]>>()

export function precargarNoticias(simbolo: string, locale: Locale): Promise<NoticiaActivo[]> {
  const clave = `${simbolo}:${locale}`
  let promesa = cacheNoticias.get(clave)
  if (!promesa) {
    promesa = fetch(`/api/globe/news?symbol=${encodeURIComponent(simbolo)}&locale=${locale}`)
      .then((res) => res.json())
      .then((body) => (Array.isArray(body?.data) ? (body.data as NoticiaActivo[]) : []))
      .catch(() => [] as NoticiaActivo[])
    cacheNoticias.set(clave, promesa)
  }
  return promesa
}

interface TarjetaActivoProps {
  marcador: Marcador
  locale: Locale
  cotizacion: { precio: number; cambio: number | null } | undefined
  posicionRef: MutableRefObject<PosicionPin>
  onCerrar: () => void
}

export function TarjetaActivo({ marcador, locale, cotizacion, posicionRef, onCerrar }: TarjetaActivoProps) {
  const dict = getDictionary(locale)
  const divRef = useRef<HTMLDivElement>(null)
  const primerEnlaceRef = useRef<HTMLAnchorElement>(null)
  const [noticias, setNoticias] = useState<NoticiaActivo[] | 'cargando'>('cargando')

  // Posicion: se proyecta cada frame dentro del Canvas (GloboHolografico.tsx, useFrame de
  // Escena) y se escribe en posicionRef sin pasar por React — este componente lee ese ref con
  // su propio requestAnimationFrame, mismo patron que el encogimiento del globo con el scroll
  // en HomeHero.tsx: mutar estilo via ref, nunca setState, para no re-renderizar 60 veces/s.
  useEffect(() => {
    let id = 0
    let fueraDesde = 0
    const paso = () => {
      id = requestAnimationFrame(paso)
      const p = posicionRef.current
      if (divRef.current) {
        divRef.current.style.transform = `translate(${p.x}px, ${p.y}px)`
        divRef.current.style.opacity = p.visible ? '1' : '0'
        divRef.current.style.pointerEvents = p.visible ? 'auto' : 'none'
      }
      // Si el pin pasa a la cara oculta un rato (no solo un frame de transicion), se cierra.
      if (!p.visible) {
        fueraDesde += 1
        if (fueraDesde > 20) onCerrar()
      } else {
        fueraDesde = 0
      }
    }
    paso()
    return () => cancelAnimationFrame(id)
  }, [posicionRef, onCerrar])

  useEffect(() => {
    // Sin reset a 'cargando' aca (seria un setState sincronico al inicio del efecto —
    // react-hooks/set-state-in-effect): en vez de eso, GloboHolografico.tsx monta un
    // <TarjetaActivo key={marcador.id}> nuevo por cada pin, asi que 'cargando' ya es el estado
    // inicial correcto de useState cada vez que se abre un pin distinto.
    let cancelado = false
    precargarNoticias(marcador.simbolo, locale).then((data) => {
      if (!cancelado) setNoticias(data)
    })
    return () => {
      cancelado = true
    }
  }, [marcador.simbolo, locale])

  useEffect(() => {
    primerEnlaceRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    const onPointerDownFuera = (e: PointerEvent) => {
      if (divRef.current && !divRef.current.contains(e.target as Node)) onCerrar()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDownFuera)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDownFuera)
    }
  }, [onCerrar])

  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
  const positivo = (cotizacion?.cambio ?? 0) >= 0
  const nombre = dict.home.globoMarcadores[marcador.nombreClave as keyof typeof dict.home.globoMarcadores] ?? marcador.simbolo

  return (
    <div
      ref={divRef}
      role="dialog"
      aria-label={nombre}
      className="absolute left-0 top-0 z-20 w-[260px] -translate-x-1/2 rounded-2xl border border-accent-cyan/30 bg-[rgba(5,12,20,0.88)] p-4 opacity-0 backdrop-blur-md transition-opacity duration-200"
      style={{ boxShadow: '0 0 40px rgba(79,195,255,0.15)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-micro uppercase tracking-wide text-accent-cyan">{marcador.simbolo}</p>
          <p className="text-body-sm font-semibold text-ink">{nombre}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label={dict.home.globoCerrarTarjeta}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-white/10 hover:text-ink"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      {cotizacion && (
        <p className="mt-2 flex items-baseline gap-2 font-mono text-body">
          <span className="text-ink">${cotizacion.precio.toLocaleString(numberLocale, { maximumFractionDigits: cotizacion.precio > 100 ? 0 : 2 })}</span>
          <span className={clsx('text-micro', positivo ? 'text-semantic-success' : 'text-semantic-danger')}>
            {cotizacion.cambio == null ? '—' : `${positivo ? '▲' : '▼'} ${Math.abs(cotizacion.cambio).toFixed(2)}%`}
          </span>
        </p>
      )}

      <div className="mt-3 border-t border-white/10 pt-3">
        {noticias === 'cargando' && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-white/10" style={{ width: `${80 - i * 15}%` }} />
            ))}
          </div>
        )}
        {Array.isArray(noticias) && noticias.length === 0 && <p className="text-micro text-ink-subtle">{dict.home.globoSinNoticias}</p>}
        {Array.isArray(noticias) && noticias.length > 0 && (
          <ul className="flex flex-col gap-2">
            {noticias.map((n, i) => (
              <li key={n.href}>
                <Link
                  ref={i === 0 ? primerEnlaceRef : undefined}
                  href={n.href}
                  className="block rounded-md px-1 py-0.5 text-micro text-ink-muted hover:bg-white/5 hover:text-ink"
                >
                  <span className="line-clamp-2">{n.titulo}</span>
                  <span className="mt-0.5 block text-[10px] text-ink-subtle">{n.fecha}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-micro">
        <Link href={`/markets?activo=${marcador.simbolo}`} className="font-medium text-accent-cyan hover:underline">
          {dict.home.globoVerTerminal}
        </Link>
        <Link href={`/buscar?q=${encodeURIComponent(marcador.simbolo)}`} className="text-ink-muted hover:text-ink hover:underline">
          {dict.home.globoTodasNoticias}
        </Link>
      </div>
    </div>
  )
}
