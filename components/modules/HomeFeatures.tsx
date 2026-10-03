'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

interface HomeFeaturesProps {
  locale: Locale
}

interface Tarjeta {
  icon: string
  href: string
  title: string
  body: string
}

export function HomeFeatures({ locale }: HomeFeaturesProps) {
  const dict = getDictionary(locale)
  const { features } = dict
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
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const tarjetas: Tarjeta[] = [
    { icon: 'article', href: '/articulos', title: features.news.title, body: features.news.body },
    { icon: 'monitoring', href: '/markets', title: features.markets.title, body: features.markets.body },
    { icon: 'calculate', href: '/pivot-points', title: features.pivots.title, body: features.pivots.body },
    { icon: 'calendar_month', href: '/calendario', title: features.calendar.title, body: features.calendar.body },
  ]

  return (
    // Sin <section> propia, sin titulo ni CTA: estas tarjetas ahora viven dentro de la misma
    // seccion del hero/globo (ver HomeHero.tsx), no como un bloque aparte debajo. El id +
    // scroll-mt se conservan porque "Ver mas" del hero sigue apuntando aca.
    <div id="lo-que-hay-dentro" ref={sectionRef} className="scroll-mt-[var(--header-scroll-offset)]">
      <div className="section-container">
        <ul aria-label={features.title} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tarjetas.map((tarjeta, i) => (
            <li key={tarjeta.href}>
              <Link
                href={tarjeta.href}
                className={clsx(
                  'group relative isolate block h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm',
                  'transition-[border-color,box-shadow,transform] duration-300 ease-out',
                  'hover:-translate-y-1.5 hover:border-accent-cyan/40 hover:shadow-[0_0_36px_var(--accent-cyan-glow)]',
                  visible ? 'hero-fade-up' : 'opacity-0'
                )}
                style={visible ? { animationDelay: `${i * 80}ms` } : undefined}
              >
                {/* Resplandor de esquina: fijo y tenue, mas visible en hover — da profundidad
                    sin competir con el numero/icono. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-10 -top-10 -z-10 size-32 rounded-full bg-accent-cyan/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                />
                {/* Numero grande detras del contenido (-z-10, contenido por el stacking context
                    propio del backdrop-blur de arriba) — chrome tipo "panel de vidrio numerado". */}
                <span aria-hidden="true" className="absolute right-4 top-3 -z-10 select-none font-mono text-4xl font-bold text-white/10">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="inline-flex size-11 items-center justify-center rounded-xl border border-accent-cyan/20 bg-accent-cyan/10 transition-transform duration-300 group-hover:scale-110">
                  <span className="material-symbols-outlined text-[22px] text-accent-cyan" aria-hidden="true">
                    {tarjeta.icon}
                  </span>
                </span>
                <h3 className="mt-4 text-body-lg font-semibold text-ink">{tarjeta.title}</h3>
                <p className="mt-2 text-body-sm text-on-surface-variant">{tarjeta.body}</p>
                {/* Linea de base que recorre el borde inferior en bucle continuo (no solo en
                    hover) — "animenlas", en vez de un adorno estatico que solo reacciona. */}
                <span
                  aria-hidden="true"
                  className="feature-card-shimmer pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-50 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ animationDelay: `${i * 700}ms` }}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
