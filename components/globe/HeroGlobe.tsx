'use client'

import dynamic from 'next/dynamic'
import { Component, useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { DatosGlobo } from './GloboHolografico'
import type { Locale } from '@/lib/i18n/get-dictionary'
import type { EstadoSesion } from '@/lib/globe/sesiones'

// ssr:false solo es valido dentro de un Client Component (confirmado en
// node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md) — por eso este archivo
// entero es 'use client' y el import dinamico vive aqui, no en HomeHero.tsx directamente.
const GloboHolograficoCliente = dynamic(() => import('./GloboHolografico'), {
  ssr: false,
  loading: () => <FallbackGlobo />,
})

function FallbackGlobo() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div
        className="size-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle at 50% 45%, rgba(79,195,255,0.18), transparent 70%)' }}
      />
    </div>
  )
}

// WebGL puede fallar en tiempo de ejecucion (contexto perdido, compilacion de shaders, etc.)
// incluso cuando el navegador lo reporta disponible. Sin esto, un error ahi tumbaria toda la
// home en vez de solo volver al fallback estatico.
class LimiteErrorGlobo extends Component<{ children: ReactNode; fallback: ReactNode }, { fallo: boolean }> {
  state = { fallo: false }
  static getDerivedStateFromError() {
    return { fallo: true }
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
}

export function HeroGlobe({ datos, ariaLabel, locale, estadosSesion, onReady }: HeroGlobeProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [soportaWebgl, setSoportaWebgl] = useState(true)
  const avisado = useRef(false)

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
        if (!gl) setSoportaWebgl(false)
      } catch {
        setSoportaWebgl(false)
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

  // Si WebGL tarda o falla, el texto del hero arranca igual a los 2s (no espera para siempre).
  useEffect(() => {
    const timeout = setTimeout(avisarListo, 2000)
    return () => clearTimeout(timeout)
  }, [avisarListo])

  if (!soportaWebgl) {
    return <FallbackGlobo />
  }

  return (
    <LimiteErrorGlobo fallback={<FallbackGlobo />}>
      <GloboHolograficoCliente
        datos={datos}
        reducedMotion={reducedMotion}
        ariaLabel={ariaLabel}
        locale={locale}
        estadosSesion={estadosSesion}
        onReady={avisarListo}
        onContextLost={() => setSoportaWebgl(false)}
      />
    </LimiteErrorGlobo>
  )
}
