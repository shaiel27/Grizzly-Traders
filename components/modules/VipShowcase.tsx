'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { NewsletterForm } from '@/components/ui'
import { DiscordIcon } from '@/components/ui/DiscordIcon'
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

export interface ResumenPreviewItem {
  categoria: string | null
  titulo: string
}

// Vista previa del resumen diario con los titulares reales de hoy. Si el sitio aún no tiene artículos,
// muestra solo la estructura del correo (barras) y se rotula como ejemplo.
function ResumenPreview({ etiqueta, cabecera, categoria, pie, items }: { etiqueta: string; cabecera: string; categoria: string; pie: string; items: ResumenPreviewItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-[#0a0a0a]">
      <div className="flex items-center gap-2 border-b border-hairline-soft bg-white/[0.02] px-3 py-2">
        <span className="material-symbols-outlined text-[14px] text-brand-amber" aria-hidden="true">
          mail
        </span>
        <span className="font-mono text-[10px] text-ink-subtle">{etiqueta}</span>
      </div>
      <div className="p-4">
        <p className="font-serif text-body font-semibold text-ink">{cabecera}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {items.length > 0
            ? items.map((item) => (
                <li key={item.titulo} className="border-t border-hairline-soft pt-3 first:border-t-0 first:pt-0">
                  {item.categoria && <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-amber">{item.categoria}</p>}
                  <p className="mt-1 line-clamp-2 text-body-sm font-semibold text-ink">{item.titulo}</p>
                </li>
              ))
            : [0, 1, 2].map((i) => (
                <li key={i} aria-hidden="true" className="border-t border-hairline-soft pt-3 first:border-t-0 first:pt-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-amber">{categoria}</p>
                  <span className="mt-1.5 block h-2.5 w-[85%] rounded bg-white/15" />
                  <span className="mt-1.5 block h-2 w-full rounded bg-white/[0.07]" />
                </li>
              ))}
        </ul>
        <p className="mt-4 border-t border-hairline-soft pt-3 text-[10px] text-ink-subtle">{pie}</p>
      </div>
    </div>
  )
}

const BENEFICIOS = (dict: ReturnType<typeof getDictionary>) => [
  { icon: 'bolt', title: dict.home.vipBeneficioAlertas, body: dict.home.vipBeneficioAlertasBody },
  { icon: 'psychology', title: dict.home.vipBeneficioAnalisis, body: dict.home.vipBeneficioAnalisisBody },
  { icon: 'groups', title: dict.home.vipBeneficioComunidad, body: dict.home.vipBeneficioComunidadBody },
]

// Lo que de verdad incluye la suscripción por correo: el resumen diario. Las alertas, el análisis con IA y la
// comunidad son del VIP, no del correo, así que esta lista no los menciona.
const BENEFICIOS_CORREO = (dict: ReturnType<typeof getDictionary>) => [
  { icon: 'mail', title: dict.home.nlBeneficioResumen, body: dict.home.nlBeneficioResumenBody },
  { icon: 'language', title: dict.home.nlBeneficioIdioma, body: dict.home.nlBeneficioIdiomaBody },
  { icon: 'check', title: dict.home.nlBeneficioControl, body: dict.home.nlBeneficioControlBody },
]

interface VipShowcaseProps {
  locale: Locale
  vipUrl?: string
  discordUrl?: string
  // Titulares reales de hoy para la vista previa del correo
  resumen?: ResumenPreviewItem[]
}

export function VipShowcase({ locale, vipUrl, discordUrl, resumen = [] }: VipShowcaseProps) {
  const dict = getDictionary(locale)
  // Sin enlace del VIP la tarjeta ofrece la suscripción por correo, con lo que esta incluye de verdad (y, si hay, la invitación a Discord)
  const modoCorreo = !vipUrl
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
    <div ref={sectionRef} className="vip-border-wrap relative mt-16 overflow-hidden rounded-2xl p-px">
      <section
        id="vip"
        className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-6 md:p-8"
        aria-label={modoCorreo ? dict.home.nlSectionAria : dict.home.vipSectionAria}
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
              {modoCorreo ? dict.home.nlBadge : dict.home.vipBadge}
            </span>
            <h2 className="mt-3 font-serif text-headline tracking-tight text-ink">{modoCorreo ? dict.home.nlTitle : dict.home.vipTitle}</h2>
            <p className="mt-2 max-w-xl text-body text-ink-subtle">{modoCorreo ? dict.home.nlLead : dict.home.vipLead}</p>

            <ul className="mt-6 flex flex-col gap-4">
              {(modoCorreo ? BENEFICIOS_CORREO(dict) : BENEFICIOS(dict)).map((b) => (
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

            {/* Sin NEXT_PUBLIC_VIP_URL la tarjeta se quedaba sin ninguna accion (plan 009 B10): se ofrece el newsletter
                como alternativa en vez de un bloque sin salida. */}
            {modoCorreo && (
              <div className="mt-6">
                <NewsletterForm />
              </div>
            )}
            {(vipUrl || discordUrl) && (
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
                {discordUrl && (
                  <a
                    href={discordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-hairline hover:bg-white/[0.08]"
                  >
                    <DiscordIcon className="size-4 text-accent-blue" />
                    {dict.home.vipDiscordJoin}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="w-full lg:w-[360px] shrink-0">
            {modoCorreo ? (
              <ResumenPreview
                etiqueta={dict.home.nlPreviewEtiqueta}
                cabecera={dict.home.nlPreviewCabecera}
                categoria={dict.home.nlPreviewCategoria}
                pie={dict.home.nlPreviewPie}
                items={resumen}
              />
            ) : (
              <ConsolaAlertas etiqueta={dict.home.vipTerminalEtiqueta} />
            )}
            <p className="mt-2 text-right text-[10px] uppercase tracking-wide text-ink-subtle">{modoCorreo && resumen.length > 0 ? dict.home.nlPreviewReal : dict.home.pivotEjemplo}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
