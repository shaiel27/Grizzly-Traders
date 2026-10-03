'use client'

import { clsx } from 'clsx'
import { CENTROS_SESION, type EstadoSesion } from '@/lib/globe/sesiones'
import type { ResultadoSentimiento } from '@/lib/globe/sentimiento'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

function formatearMinutos(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const resto = min % 60
  return resto === 0 ? `${h}h` : `${h}h ${resto}min`
}

interface LeyendaGloboProps {
  estados: EstadoSesion[]
  riesgo: ResultadoSentimiento | null
  locale: Locale
}

export function LeyendaGlobo({ estados, riesgo, locale }: LeyendaGloboProps) {
  const dict = getDictionary(locale)
  if (estados.length === 0) return null

  // Hasta 2 sesiones abiertas; si no hay ninguna, la que abre mas pronto — asi la leyenda
  // siempre dice algo util, no solo "todo cerrado".
  const abiertas = estados.filter((e) => e.abierto).slice(0, 2)
  const destacadas =
    abiertas.length > 0
      ? abiertas
      : [...estados].filter((e) => e.minutosProximoCambio != null).sort((a, b) => (a.minutosProximoCambio ?? 0) - (b.minutosProximoCambio ?? 0)).slice(0, 1)

  const riesgoClase =
    riesgo?.clasificacion === 'RISK-ON'
      ? 'text-semantic-success border-semantic-success/40 bg-semantic-success/10'
      : riesgo?.clasificacion === 'RISK-OFF'
        ? 'text-semantic-danger border-semantic-danger/40 bg-semantic-danger/10'
        : 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10'
  const riesgoLabel =
    riesgo?.clasificacion === 'RISK-ON' ? dict.home.globoRiskOn : riesgo?.clasificacion === 'RISK-OFF' ? dict.home.globoRiskOff : dict.home.globoRiskNeutral
  const flecha = riesgo && riesgo.score !== 0 ? (riesgo.score > 0 ? '▲' : '▼') : ''

  return (
    <div
      aria-live="polite"
      className="pointer-events-none flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 font-mono text-micro text-ink-muted"
    >
      {destacadas.map((e) => {
        const centro = CENTROS_SESION.find((c) => c.id === e.id)
        if (!centro || e.minutosProximoCambio == null) return null
        const nombre = dict.home.globoSesiones[centro.nombreClave as keyof typeof dict.home.globoSesiones] ?? centro.id
        const texto = e.abierto ? dict.home.globoSesionAbierta : dict.home.globoSesionCerrada
        return (
          <span key={e.id} className="inline-flex items-center gap-1.5">
            <span className={clsx('size-1.5 rounded-full', e.abierto ? 'splash-mark bg-semantic-success' : 'bg-ink-subtle')} aria-hidden="true" />
            {nombre} {texto.replace('{tiempo}', formatearMinutos(e.minutosProximoCambio))}
          </span>
        )
      })}
      {riesgo && (
        <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold', riesgoClase)}>
          {riesgoLabel} {flecha}
        </span>
      )}
    </div>
  )
}
