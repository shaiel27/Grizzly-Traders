'use client'

import dynamic from 'next/dynamic'
import { Component, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DatosGlobo } from './GloboHolografico'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'
import type { EstadoSesion } from '@/lib/globe/sesiones'

// ssr:false solo es valido dentro de un Client Component (confirmado en
// node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md) — por eso este archivo
// entero es 'use client' y el import dinamico vive aqui, no en HomeHero.tsx directamente.
// El fallback de carga NO vive en `loading`: FallbackGlobo necesita el estado y el locale para
// escribir su copy, y dynamic() se declara a nivel de modulo (ademas, el mismo doc prohibe
// llamarlo dentro del render). Mientras carga el chunk, dynamic pinta null y el overlay de
// 'cargando' de abajo es lo que se ve.
const GloboHolograficoCliente = dynamic(() => import('./GloboHolografico'), {
  ssr: false,
  loading: () => null,
})

// F0-02: los cuatro estados del globo (cargando, sin WebGL, error en runtime/contexto perdido
// y listo) se veian identicos — un glow sin texto — y la pista de arrastre del hero se pintaba
// aunque no hubiera globo. Este tipo es el contrato que HeroGlobe reporta al padre via
// onEstadoCarga. onReady/timeout del padre NO cambian: el texto del hero sigue apareciendo al
// primer frame del canvas o a los 2000ms, venga como venga el estado.
export type EstadoCargaGlobo = 'listo' | 'cargando' | 'sin-webgl' | 'error'

// Estados que se quedan sin globo y por tanto se pintan en el fallback con su copy propio.
type EstadoFallback = Exclude<EstadoCargaGlobo, 'listo'>

// Radio de la esfera proyectada, en fraccion del semi-lado de la caja: esfera de radio 1 vista
// desde z=5.2 con fov 42 (camara de GloboHolografico) -> tan(asin(1/5.2)) / tan(21deg) = 0.5106.
// Medido en captura a 1440px: caja de 1062px, globo de ~544px de diametro (0.512). Con viewBox
// -100..100 el contorno cae exactamente donde aparece el globo real: sin salto al cruzarse.
const R_SILUETA = 51.06

// Placeholder de carga: la silueta del globo con un brillo que recorre el limbo. SVG + CSS puro
// (cero JS por frame, nada de WebGL), del mismo tamaño y posicion que la esfera final. El
// movimiento vive en clases de globals.css y lo congela tanto motion-reduce como el catch-all de
// prefers-reduced-motion; congelado sigue leyendose (contorno + reflejo estatico).
function SiluetaGlobo() {
  return (
    <svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false" className="globo-silueta absolute inset-0 size-full overflow-visible">
      <defs>
        <radialGradient id="globo-silueta-relleno" cx="0" cy="0" r={R_SILUETA} fx="-14" fy="-18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0d3150" stopOpacity="0.45" />
          <stop offset="0.8" stopColor="#081e33" stopOpacity="0.5" />
          <stop offset="1" stopColor="#4fc3ff" stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id="globo-silueta-atmosfera" cx="0" cy="0" r={R_SILUETA * 1.14} gradientUnits="userSpaceOnUse">
          <stop offset={R_SILUETA / (R_SILUETA * 1.14)} stopColor="#4fc3ff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#4fc3ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="globo-silueta-barrido" x1={R_SILUETA} y1="0" x2="0" y2={R_SILUETA} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7fd4ff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#7fd4ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="globo-silueta-clip">
          <circle r={R_SILUETA} />
        </clipPath>
      </defs>
      <circle r={R_SILUETA * 1.14} fill="url(#globo-silueta-atmosfera)" />
      <g className="globo-silueta-respira">
        <circle r={R_SILUETA} fill="url(#globo-silueta-relleno)" />
        {/* Reticula minima (ecuador + dos meridianos) recortada a la esfera: insinua el globo
            sin competir con el real. non-scaling-stroke: 1px en movil y en desktop por igual. */}
        <g clipPath="url(#globo-silueta-clip)" fill="none" stroke="#7fd4ff" strokeOpacity="0.14" strokeWidth="1" vectorEffect="non-scaling-stroke">
          <ellipse rx={R_SILUETA} ry={R_SILUETA * 0.22} vectorEffect="non-scaling-stroke" />
          <ellipse rx={R_SILUETA * 0.42} ry={R_SILUETA} vectorEffect="non-scaling-stroke" />
          <ellipse rx={R_SILUETA * 0.8} ry={R_SILUETA} vectorEffect="non-scaling-stroke" />
        </g>
        <circle r={R_SILUETA} fill="none" stroke="#4fc3ff" strokeOpacity="0.45" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>
      {/* Arco de luz sobre el limbo: un cuarto de circunferencia que gira despacio. */}
      <g className="globo-silueta-barrido motion-reduce:animate-none">
        <circle
          r={R_SILUETA}
          fill="none"
          stroke="url(#globo-silueta-barrido)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(Math.PI * 2 * R_SILUETA) / 4} ${Math.PI * 2 * R_SILUETA}`}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  )
}

function FallbackGlobo({ estado, locale }: { estado: EstadoFallback; locale: Locale }) {
  const dict = getDictionary(locale).home
  if (estado === 'cargando') {
    // Mientras carga no hay texto visible: la silueta ocupa el sitio del globo y el estado se
    // anuncia solo a lectores de pantalla (mismo role="status" que los demas estados).
    return (
      <div role="status" aria-live="polite" className="absolute inset-0">
        <SiluetaGlobo />
        <span className="sr-only">{dict.globoEstadoCargando}</span>
      </div>
    )
  }
  const texto = estado === 'sin-webgl' ? dict.globoEstadoSinWebgl : dict.globoEstadoError
  return (
    // role="status" + aria-live="polite": los cambios de estado se anuncian sin robar foco.
    <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {/* Glow decorativo, igual al de siempre: aria-hidden para que solo se anuncie el copy. */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle at 50% 45%, rgba(79,195,255,0.18), transparent 70%)' }}
      />
      {/* relative: por encima del glow (ambos posicionados, gana el orden del DOM) sin
          necesidad de z-index. text-micro (12px) + --ink-muted sobre el halo: legible. */}
      <p className="relative max-w-[85%] px-4 text-center font-mono text-micro text-ink-muted">{texto}</p>
    </div>
  )
}

// WebGL puede fallar en tiempo de ejecucion (contexto perdido, compilacion de shaders, etc.)
// incluso cuando el navegador lo reporta disponible. Sin esto, un error ahi tumbaria toda la
// home en vez de solo volver al fallback estatico. El fallback visible lo decide `estado` en
// HeroGlobe (onError -> 'error'), asi que aqui solo captura: no puede quedarse un frame con
// dos copies superpuestos.
class LimiteErrorGlobo extends Component<{ children: ReactNode; fallback: ReactNode; onError?: () => void }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
  }
  componentDidCatch() {
    this.props.onError?.()
  }
  render() {
    return this.state.fallo ? this.props.fallback : this.props.children
  }
}

interface HeroGlobeProps {
  datos: DatosGlobo
  ariaLabel: string
  locale: Locale
  estadosSesion: EstadoSesion[]
  onReady?: () => void
  // F0-02: reporte de la maquina de estados al padre. Independiente de onReady — el padre ya
  // tiene su propio `listo` (onReady o timeout de 2s) para el texto del hero y no cambia.
  onEstadoCarga?: (e: EstadoCargaGlobo) => void
}

export function HeroGlobe({ datos, ariaLabel, locale, estadosSesion, onReady, onEstadoCarga }: HeroGlobeProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  // Maquina de estados (F0-02). Arranca en 'cargando' tambien en SSR, donde todavia no hay
  // canvas. Transiciones: sin WebGL -> 'sin-webgl'; error en runtime o contexto perdido ->
  // 'error'; primer frame del canvas -> 'listo' (el mismo disparador de onReady, pero reportado
  // aparte para no tocar ese contrato).
  const [estado, setEstado] = useState<EstadoCargaGlobo>('cargando')
  const avisado = useRef(false)

  // onEstadoCarga va por ref: el padre puede pasar un arrow inline y no queremos re-reportar
  // en cada render suyo — solo cuando cambia el estado.
  const reportarRef = useRef(onEstadoCarga)
  useEffect(() => {
    reportarRef.current = onEstadoCarga
  })
  useEffect(() => {
    reportarRef.current?.(estado)
  }, [estado])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    // setState no puede ser lo primero que corre un effect (react-hooks/set-state-in-effect);
    // se difiere igual que la deteccion de reduced-motion de ForexCalendar.
    const detectar = () => {
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
        // Solo si seguimos esperando: si el globo ya fallo antes, 'error' es el estado honesto
        // y la deteccion no lo debe pisar.
        if (!gl) setEstado((e) => (e === 'cargando' ? 'sin-webgl' : e))
      } catch {
        setEstado((e) => (e === 'cargando' ? 'sin-webgl' : e))
      }
    }
    const timeout = setTimeout(detectar, 0)
    return () => clearTimeout(timeout)
  }, [])

  const avisarListo = useCallback(() => {
    if (avisado.current) return
    avisado.current = true
    onReady?.()
  }, [onReady])

  // El globo avisa de su primer frame: ese es el unico camino a 'listo' (la deteccion y el
  // timeout de abajo no pueden llegar a el).
  const globoListo = useCallback(() => {
    setEstado((e) => (e === 'cargando' ? 'listo' : e))
    avisarListo()
  }, [avisarListo])

  // Contexto perdido en runtime y errores capturados por el boundary: mismo destino visual
  // (sin globo), estado 'error' para distinguirlo de "este navegador no tiene WebGL".
  const marcarError = useCallback(() => setEstado('error'), [])

  // Si WebGL tarda o falla, el texto del hero arranca igual a los 2s (no espera para siempre).
  useEffect(() => {
    const timeout = setTimeout(avisarListo, 2000)
    return () => clearTimeout(timeout)
  }, [avisarListo])

  // F6 P2-3 — puente loader -> escena: al pasar a 'listo' la escena arranca en opacity 0
  // (holograma 0->0.5s), asi que desmontar el overlay en ese mismo commit dejaba 1-3 frames
  // de vacio. El overlay se queda 220ms mas fundiendose (opacity 200ms con --ease-out) para
  // que loader y escena se crucen en vez de cortar. Estado derivado en fase de render (patron
  // "adjusting state when props change"): si lo hiciera un useEffect, el render del flip
  // desmontaria el overlay un commit antes de que fundiendo=true y no habria transicion.
  const [estadoPrevio, setEstadoPrevio] = useState(estado)
  const [fundiendo, setFundiendo] = useState(false)
  if (estadoPrevio !== estado) {
    setEstadoPrevio(estado)
    setFundiendo(estado === 'listo')
  }
  useEffect(() => {
    if (!fundiendo) return
    const id = setTimeout(() => setFundiendo(false), 220)
    return () => clearTimeout(id)
  }, [fundiendo])

  // Sin WebGL (o ya en error): solo el fallback con su copy, sin montar el canvas.
  if (estado === 'sin-webgl' || estado === 'error') {
    return <FallbackGlobo estado={estado} locale={locale} />
  }

  return (
    <>
      {/* fallback=null a proposito: el fallback visible lo decide `estado` (via onError ->
          'error' en componentDidCatch), asi el overlay de 'cargando' sigue pintado durante el
          frame intermedio y el cambio de copy es cargando -> error, sin solapes. */}
      <LimiteErrorGlobo fallback={null} onError={marcarError}>
        <GloboHolograficoCliente
          datos={datos}
          reducedMotion={reducedMotion}
          ariaLabel={ariaLabel}
          locale={locale}
          estadosSesion={estadosSesion}
          onReady={globoListo}
          onContextLost={marcarError}
        />
      </LimiteErrorGlobo>
      {/* Overlay de 'cargando': mas tarde en el DOM que el canvas (ambos posicionados) para
          quedar por encima mientras el chunk carga o antes del primer frame; al llegar a
          'listo' no se desmonta de golpe (hueco de 1-3 frames con la escena en opacity 0)
          sino que se funde 200ms y recien entonces se va (fundiendo). pointer-events-none
          en el wrapper: el overlay nunca debe tapar el arrastre/tap del globo. */}
      {(estado === 'cargando' || fundiendo) && (
        <div
          className={`pointer-events-none transition-opacity duration-200 ease-[var(--ease-out)]${estado === 'listo' ? ' opacity-0' : ''}`}
        >
          <FallbackGlobo estado="cargando" locale={locale} />
        </div>
      )}
    </>
  )
}
