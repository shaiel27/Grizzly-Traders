'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { NewsletterForm } from '@/components/ui'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

// Lineas de ejemplo para la "consola" de alertas — simbolos/numeros, no prosa, mismo criterio
// que las etiquetas de los anillos del globo o CATEGORY_LABELS del header: jerga de trading que
// no necesita traduccion. Nunca se presentan como datos reales (ver la etiqueta "Ejemplo").
const LINEAS_EJEMPLO = [
  '▲ XAU/USD rompe R1 · 2,401.3',
  '● BTC/USD cruza EMA50 · 64,820',
  '▼ EUR/USD toca S2 · 1.0812',
  '▲ Sentimiento NASDAQ: alcista (72%)',
]

function ConsolaAlertas({ etiqueta }: { etiqueta: string }) {
  const [lineasListas, setLineasListas] = useState(0)
  const [charsLinea, setCharsLinea] = useState(0)

  useEffect(() => {
    // El setState siempre pasa por un setTimeout, en TODAS las ramas (incluida la de
    // reduced-motion): llamarlo directo y sincronico en el cuerpo del efecto dispara
    // react-hooks/set-state-in-effect (cascada de renders en el mismo commit). Con el
    // setTimeout, aunque sea de 0ms, ya no es "sincronico dentro del efecto".
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = setTimeout(() => setLineasListas(LINEAS_EJEMPLO.length), 0)
      return () => clearTimeout(id)
    }
    if (lineasListas >= LINEAS_EJEMPLO.length) return
    const lineaActual = LINEAS_EJEMPLO[lineasListas]
    if (charsLinea >= lineaActual.length) {
      const pausa = setTimeout(() => {
        setLineasListas((v) => v + 1)
        setCharsLinea(0)
      }, 500)
      return () => clearTimeout(pausa)
    }
    const id = setTimeout(() => setCharsLinea((v) => v + 1), 28)
    return () => clearTimeout(id)
  }, [lineasListas, charsLinea])

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-[#0a0a0a]">
      <div className="flex items-center gap-2 border-b border-hairline-soft bg-white/[0.02] px-3 py-2">
        <span className="size-2.5 rounded-full bg-semantic-danger/70" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-semantic-warning/70" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-semantic-success/70" aria-hidden="true" />
        <span className="ml-2 font-mono text-[10px] text-ink-subtle">{etiqueta}</span>
      </div>
      <div className="min-h-[132px] p-3 font-mono text-[12px] leading-relaxed text-ink-muted">
        {LINEAS_EJEMPLO.map((linea, i) => {
          const completa = i < lineasListas
          const enCurso = i === lineasListas
          if (!completa && !enCurso) return null
          const texto = completa ? linea : linea.slice(0, charsLinea)
          const positivo = linea.startsWith('▲')
          const negativo = linea.startsWith('▼')
          return (
            <p key={linea} className={positivo ? 'text-semantic-success' : negativo ? 'text-semantic-danger' : 'text-accent-blue'}>
              {texto}
              {enCurso && <span className="splash-mark">▊</span>}
            </p>
          )
        })}
      </div>
    </div>
  )
}

const BENEFICIOS = (dict: ReturnType<typeof getDictionary>) => [
  { icon: 'bolt', title: dict.home.vipBeneficioAlertas, body: dict.home.vipBeneficioAlertasBody },
  { icon: 'psychology', title: dict.home.vipBeneficioAnalisis, body: dict.home.vipBeneficioAnalisisBody },
  { icon: 'groups', title: dict.home.vipBeneficioComunidad, body: dict.home.vipBeneficioComunidadBody },
]

interface VipShowcaseProps {
  locale: Locale
  vipUrl?: string
  telegramUrl?: string
}

export function VipShowcase({ locale, vipUrl, telegramUrl }: VipShowcaseProps) {
  const dict = getDictionary(locale)
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={sectionRef} className="vip-border-wrap relative mt-16 rounded-2xl p-px">
      <section
        id="vip"
        className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-6 md:p-8"
        aria-label={dict.home.vipSectionAria}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-1/4 -top-1/3 size-[60%] rounded-full blur-[90px]"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--brand-amber) 35%, transparent) 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
          <div className="flex-1">
            <span
              className={clsx('inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-micro font-semibold uppercase tracking-wide text-brand-amber', visible && 'vip-badge-shine')}
            >
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                workspace_premium
              </span>
              {dict.home.vipBadge}
            </span>
            <h2 className="mt-3 text-headline tracking-tight text-ink">{dict.home.vipTitle}</h2>
            <p className="mt-2 max-w-xl text-body text-ink-subtle">{dict.home.vipLead}</p>

            <ul className="mt-6 flex flex-col gap-4">
              {BENEFICIOS(dict).map((b) => (
                <li key={b.title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-amber/25 bg-brand-amber/10">
                    <span className="material-symbols-outlined text-[18px] text-brand-amber" aria-hidden="true">
                      {b.icon}
                    </span>
                  </span>
                  <div>
                    <p className="text-body-sm font-semibold text-ink">{b.title}</p>
                    <p className="text-micro text-ink-muted">{b.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            {(vipUrl || telegramUrl) && (
              <div className="mt-6 flex flex-wrap gap-3">
                {vipUrl && (
                  <a
                    href={vipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-blue-hover"
                  >
                    {dict.home.vipJoin}
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      arrow_outward
                    </span>
                  </a>
                )}
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-hairline hover:bg-white/[0.08]"
                  >
                    <span className="material-symbols-outlined text-[16px] text-accent-blue" aria-hidden="true">
                      send
                    </span>
                    {dict.home.vipTelegramJoin}
                  </a>
                )}
              </div>
            )}
            {/* Sin NEXT_PUBLIC_VIP_URL ni NEXT_PUBLIC_TELEGRAM_URL configuradas, la tarjeta se
                quedaba sin ninguna accion (plan 009 B10) — se ofrece el newsletter como
                alternativa en vez de un bloque sin salida. */}
            {!vipUrl && !telegramUrl && (
              <div className="mt-6">
                <NewsletterForm />
              </div>
            )}
          </div>

          <div className="w-full lg:w-[360px] shrink-0">
            <ConsolaAlertas etiqueta={dict.home.vipTerminalEtiqueta} />
            <p className="mt-2 text-right text-[10px] uppercase tracking-wide text-ink-subtle">{dict.home.pivotEjemplo}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
