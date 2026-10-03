'use client'

import { useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { PivotLadder } from '@/components/ui/PivotLadder'
import { PIVOT_METHODS, levelsFor, type PivotMethod, type PivotResult } from '@/lib/pivots'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

export interface ActivoPivote {
  tv: string
  label: string
  result: PivotResult
  price: number
}

// Ejemplo estatico: si getPivotQuotes('D') falla, esta seccion muestra esto en vez de una caja
// vacia o desaparecer entera (plan 009 §13.1) — numeros de muestra, nunca se presentan como
// datos reales (de ahi la etiqueta "Ejemplo" mas abajo).
const EJEMPLO: ActivoPivote[] = [
  {
    tv: 'EJEMPLO:BTCUSD',
    label: 'BTC/USD',
    price: 64_210,
    result: {
      classic: { pivot: 64000, s1: 62800, s2: 61600, s3: 60400, r1: 65200, r2: 66400, r3: 67600 },
      fibonacci: { pivot: 64000, s1: 63100, s2: 62500, s3: 61600, r1: 64900, r2: 65500, r3: 66400 },
      camarilla: { pivot: 64000, s1: 63850, s2: 63700, s3: 63550, s4: 63400, r1: 64150, r2: 64300, r3: 64450, r4: 64600 },
      woodie: { pivot: 64050, s1: 62850, s2: 61650, s3: 60450, r1: 65250, r2: 66450, r3: 67650 },
      demark: { pivot: 64100, s1: 62900, r1: 65300 },
    },
  },
]

interface PivotShowcaseProps {
  activos: ActivoPivote[]
  locale: Locale
}

export function PivotShowcase({ activos, locale }: PivotShowcaseProps) {
  const dict = getDictionary(locale)
  const esEjemplo = activos.length === 0
  const lista = esEjemplo ? EJEMPLO : activos
  const [metodo, setMetodo] = useState<PivotMethod>('classic')
  const [activoIdx, setActivoIdx] = useState(0)
  const activo = lista[Math.min(activoIdx, lista.length - 1)]
  const levels = levelsFor(activo.result, metodo)

  return (
    <section className="mt-16 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-8" aria-label={dict.home.pivotSectionAria}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-[24px] text-accent-blue" aria-hidden="true">
              functions
            </span>
            <h2 className="text-headline text-ink">{dict.home.pivotTitle}</h2>
          </div>
          <p className="text-body text-on-surface-variant max-w-md">{dict.home.pivotDesc}</p>

          <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label={dict.home.pivotMethodsLabel}>
            {PIVOT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={metodo === m}
                onClick={() => setMetodo(m)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-micro font-semibold uppercase tracking-wide transition-colors',
                  metodo === m ? 'border-accent-blue bg-accent-blue/15 text-accent-blue' : 'border-outline-variant/40 text-ink-muted hover:text-ink'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/pivot-points"
              className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-blue-hover"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                candlestick_chart
              </span>
              {dict.home.pivotCta}
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl bg-surface-2 p-1" role="tablist" aria-label={dict.home.pivotLevelsLabel}>
              {lista.map((a, i) => (
                <button
                  key={a.tv}
                  type="button"
                  role="tab"
                  aria-selected={activoIdx === i}
                  onClick={() => setActivoIdx(i)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 font-mono text-micro font-semibold transition-colors',
                    activoIdx === i ? 'bg-surface-container-lowest text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
            {esEjemplo && (
              <span className="shrink-0 rounded-full border border-semantic-warning/40 bg-semantic-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-semantic-warning">
                {dict.home.pivotEjemplo}
              </span>
            )}
          </div>
          <PivotLadder levels={levels} price={activo.price} symbol={activo.label} height={280} />
        </div>
      </div>
    </section>
  )
}
