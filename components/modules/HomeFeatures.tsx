'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { clsx } from 'clsx'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

export interface NoticiaPreview {
  titulo: string
  href: string
  sentimientoLabel: string
  sentimientoClase: string
  fecha: string
}

export interface CotizacionPreview {
  simbolo: string
  label: string
  precio: number
  cambio: number | null
  moneda: boolean
}

export interface PivotePreview {
  s3: number
  s2: number
  s1: number
  pivot: number
  r1: number
  r2: number
  r3: number
  precioActual: number
}

interface HomeFeaturesProps {
  locale: Locale
  noticiasPreview: NoticiaPreview[]
  cotizacionesPreview: CotizacionPreview[]
  pivotePreview: PivotePreview | null
}

interface EventoCalendario {
  time: string
  country: string
  event: string
  impact: string
}

// Mueve el puntero a variables CSS (--mx/--my) en vez de a React state: el spotlight de la
// tarjeta se mueve en cada frame de pointermove y un setState ahi re-renderizaria las 4
// tarjetas constantemente por nada.
function onMoveSpotlight(e: ReactPointerEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function paisABandera(codigo: string): string {
  if (!/^[a-zA-Z]{2}$/.test(codigo)) return ''
  return String.fromCodePoint(...codigo.toUpperCase().split('').map((c) => 127397 + c.charCodeAt(0)))
}

// --- Vista previa: Noticias verificadas — titulares rotando cada 4s ---
function NoticiasRotator({ items }: { items: NoticiaPreview[] }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI((v) => (v + 1) % items.length), 4000)
    return () => clearInterval(id)
  }, [items.length])

  if (items.length === 0) return null
  const item = items[i]

  return (
    <div className="relative h-[72px] overflow-hidden">
      <Link key={i} href={item.href} className="hero-fade-up absolute inset-0 flex flex-col justify-center gap-1.5" style={{ animationDuration: '350ms' }}>
        <span className={clsx('inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', item.sentimientoClase)}>
          {item.sentimientoLabel}
        </span>
        <p className="line-clamp-2 text-body-sm font-medium text-ink">{item.titulo}</p>
        <p className="text-[10px] text-ink-subtle">{item.fecha}</p>
      </Link>
    </div>
  )
}

// --- Vista previa: Terminal de mercados — BTC / oro / S&P 500, datos reales del snapshot ---
function MercadosFilas({ items, locale }: { items: CotizacionPreview[]; locale: Locale }) {
  if (items.length === 0) return null
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'

  return (
    <div className="flex flex-col justify-center gap-2.5">
      {items.map((q) => {
        const positivo = (q.cambio ?? 0) >= 0
        return (
          <div key={q.simbolo} className="flex items-center justify-between gap-2 font-mono text-micro">
            <span className="text-ink-muted">{q.label}</span>
            <span className="tabular-nums text-ink">
              {q.moneda ? '$' : ''}
              {q.precio.toLocaleString(numberLocale, { maximumFractionDigits: q.precio > 100 ? 0 : 2 })}
            </span>
            <span className={clsx('w-16 shrink-0 text-right tabular-nums', positivo ? 'text-semantic-success' : 'text-semantic-danger')}>
              {q.cambio == null ? '—' : `${positivo ? '▲' : '▼'} ${Math.abs(q.cambio).toFixed(2)}%`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// --- Vista previa: Puntos pivote — escalera R3..S3 de BTC con el precio actual marcado ---
function PivoteEscalera({ datos }: { datos: PivotePreview | null }) {
  if (!datos) return null
  const niveles = [
    { label: 'R3', valor: datos.r3 },
    { label: 'R2', valor: datos.r2 },
    { label: 'R1', valor: datos.r1 },
    { label: 'P', valor: datos.pivot },
    { label: 'S1', valor: datos.s1 },
    { label: 'S2', valor: datos.s2 },
    { label: 'S3', valor: datos.s3 },
  ]
  const min = Math.min(datos.s3, datos.precioActual)
  const max = Math.max(datos.r3, datos.precioActual)
  const rango = max - min || 1
  const posicion = ((datos.precioActual - min) / rango) * 100

  return (
    <div className="flex h-[140px] items-stretch gap-3">
      <div className="relative w-px shrink-0 bg-hairline">
        <span
          aria-hidden="true"
          className="absolute left-1/2 size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-accent-cyan shadow-[0_0_8px_var(--accent-cyan-glow)]"
          style={{ bottom: `${posicion}%` }}
        />
      </div>
      <div className="flex flex-1 flex-col justify-between py-0.5 font-mono text-[10px]">
        {niveles.map((n) => (
          <div key={n.label} className="flex items-center justify-between gap-2">
            <span className={clsx('font-semibold', n.label === 'P' ? 'text-accent-cyan' : n.label[0] === 'R' ? 'text-semantic-success' : 'text-semantic-danger')}>
              {n.label}
            </span>
            <span className="tabular-nums text-ink-muted">{n.valor.toLocaleString(undefined, { maximumFractionDigits: n.valor > 100 ? 0 : 2 })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Vista previa: Calendario económico — proximo evento de alto impacto con cuenta atras ---
// Se pide aparte (no en page.tsx con el resto): si /api/economic-calendar falla (sin
// FINNHUB_API_KEY, p.ej.) esta tarjeta sola se queda sin vista previa, el resto de la home no
// se entera.
function CalendarioPreview() {
  const [evento, setEvento] = useState<EventoCalendario | null>(null)
  const [faltan, setFaltan] = useState('')

  useEffect(() => {
    let cancelado = false
    fetch('/api/economic-calendar')
      .then((r) => r.json())
      .then((body: { data?: EventoCalendario[] }) => {
        if (cancelado) return
        const ahora = Date.now()
        const proximo = (body.data ?? [])
          .filter((e) => e.impact === 'high' && new Date(e.time).getTime() > ahora)
          .sort((a, b) => a.time.localeCompare(b.time))[0]
        setEvento(proximo ?? null)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (!evento) return
    const actualizar = () => {
      const ms = new Date(evento.time).getTime() - Date.now()
      if (ms <= 0) {
        setFaltan('00:00:00')
        return
      }
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      const s = Math.floor((ms % 60_000) / 1_000)
      setFaltan(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    actualizar()
    const id = setInterval(actualizar, 1000)
    return () => clearInterval(id)
  }, [evento])

  if (!evento) return null

  return (
    <div className="flex flex-col justify-center gap-1.5">
      <p className="flex items-center gap-1.5 text-body-sm font-medium text-ink">
        <span aria-hidden="true">{paisABandera(evento.country)}</span>
        <span className="truncate">{evento.event}</span>
      </p>
      <p className="font-mono text-headline-sm tabular-nums text-accent-cyan">{faltan}</p>
    </div>
  )
}

interface Tarjeta {
  icon: string
  href: string
  title: string
  body: string
  preview: React.ReactNode
}

function TarjetaBento({ tarjeta, i, visible, className }: { tarjeta: Tarjeta; i: number; visible: boolean; className?: string }) {
  return (
    <Link
      href={tarjeta.href}
      onPointerMove={onMoveSpotlight}
      className={clsx(
        'group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-6',
        'transition-[border-color,box-shadow,transform] duration-300 ease-out',
        'hover:-translate-y-1 hover:border-accent-cyan/35 hover:shadow-[0_0_36px_var(--accent-cyan-glow)]',
        visible ? 'hero-fade-up' : 'opacity-0',
        className
      )}
      style={visible ? { animationDelay: `${i * 80}ms` } : undefined}
    >
      {/* Spotlight: radial-gradient tenue que sigue al cursor, via --mx/--my (sin re-render). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(220px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--accent-cyan) 10%, transparent), transparent 70%)' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-8 -top-8 -z-10 size-28 rounded-full bg-accent-cyan/10 blur-2xl"
      />

      <div className="flex items-center justify-between">
        <span className="inline-flex size-10 items-center justify-center rounded-xl border border-accent-cyan/20 bg-accent-cyan/10 transition-transform duration-300 group-hover:scale-110">
          <span className="material-symbols-outlined text-[20px] text-accent-cyan" aria-hidden="true">
            {tarjeta.icon}
          </span>
        </span>
        <span className="material-symbols-outlined text-[18px] text-ink-subtle transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent-cyan" aria-hidden="true">
          arrow_outward
        </span>
      </div>

      <div className="mt-5 flex-1">{tarjeta.preview}</div>

      <div className="mt-5">
        <h3 className="text-body-lg font-semibold text-ink">{tarjeta.title}</h3>
        <p className="mt-1.5 text-body-sm text-on-surface-variant">{tarjeta.body}</p>
      </div>
    </Link>
  )
}

export function HomeFeatures({ locale, noticiasPreview, cotizacionesPreview, pivotePreview }: HomeFeaturesProps) {
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
    { icon: 'article', href: '/articulos', title: features.news.title, body: features.news.body, preview: <NoticiasRotator items={noticiasPreview} /> },
    { icon: 'monitoring', href: '/markets', title: features.markets.title, body: features.markets.body, preview: <MercadosFilas items={cotizacionesPreview} locale={locale} /> },
    { icon: 'calculate', href: '/pivot-points', title: features.pivots.title, body: features.pivots.body, preview: <PivoteEscalera datos={pivotePreview} /> },
    { icon: 'calendar_month', href: '/calendario', title: features.calendar.title, body: features.calendar.body, preview: <CalendarioPreview /> },
  ]
  // Bento 3/3/2/4 en columnas de 6: noticias y mercados grandes, pivotes y calendario medianas.
  const spanDesktop = ['lg:col-span-3 min-h-[300px]', 'lg:col-span-3 min-h-[300px]', 'lg:col-span-2 min-h-[220px]', 'lg:col-span-4 min-h-[220px]']

  return (
    <div id="lo-que-hay-dentro" ref={sectionRef} className="scroll-mt-[var(--header-scroll-offset)]">
      <div className="section-container">
        {/* Movil: carrusel horizontal con scroll-snap (una tarjeta a la vez, se desliza). */}
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={features.title}>
          {tarjetas.map((tarjeta, i) => (
            <li key={tarjeta.href} className="w-[82vw] shrink-0 snap-center">
              <TarjetaBento tarjeta={tarjeta} i={i} visible={visible} className="min-h-[360px]" />
            </li>
          ))}
        </ul>

        {/* Tablet+: grilla bento (2 columnas en tablet, 6 en escritorio). */}
        <ul className="hidden grid-cols-2 gap-5 sm:grid lg:grid-cols-6" aria-label={features.title}>
          {tarjetas.map((tarjeta, i) => (
            <li key={tarjeta.href} className={spanDesktop[i]}>
              <TarjetaBento tarjeta={tarjeta} i={i} visible={visible} className="h-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
