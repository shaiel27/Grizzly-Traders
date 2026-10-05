'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
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
  event_timestamp: string | null
  currency: string
  impact: string
  title: string
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
function PivoteEscalera({ datos, locale }: { datos: PivotePreview | null; locale: Locale }) {
  if (!datos) return null
  // locale explicito, no `undefined` (= locale del runtime): en el servidor Node.js suele
  // resolver a en-US y en el navegador al idioma configurado por el usuario — con es-ES ese
  // separador de miles pasa de coma a punto (89,399 vs 89.399) y React descarta todo el arbol
  // por mismatch de hidratacion (visto en Safari con el sistema en español, plan 009 fix).
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
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
            <span className="tabular-nums text-ink-muted">{n.valor.toLocaleString(numberLocale, { maximumFractionDigits: n.valor > 100 ? 0 : 2 })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Vista previa: Calendario económico — proximo evento de alto impacto con cuenta atras ---
// Se pide aparte (no en page.tsx con el resto): si /api/forex-calendar falla esta tarjeta sola
// se queda sin vista previa, el resto de la home no se entera. Misma fuente que ForexCalendar.tsx
// (tabla `economic_events` en Supabase, sincronizada por el automatismo n8n/ForexFactory) — ya
// no depende de Finnhub (rate-limited) como antes.
function CalendarioPreview() {
  const [evento, setEvento] = useState<EventoCalendario | null>(null)
  const [faltan, setFaltan] = useState('')

  useEffect(() => {
    let cancelado = false
    fetch('/api/forex-calendar')
      .then((r) => r.json())
      .then((body: { data?: EventoCalendario[] }) => {
        if (cancelado) return
        const ahora = Date.now()
        const proximo = (body.data ?? [])
          .filter((e) => e.impact === 'high' && e.event_timestamp && new Date(e.event_timestamp).getTime() > ahora)
          .sort((a, b) => (a.event_timestamp as string).localeCompare(b.event_timestamp as string))[0]
        setEvento(proximo ?? null)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (!evento?.event_timestamp) return
    const timestamp = evento.event_timestamp
    const actualizar = () => {
      const ms = new Date(timestamp).getTime() - Date.now()
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
        <span className="shrink-0 rounded-[4px] bg-surface-2 px-1 py-0.5 font-mono text-[9px] text-ink-subtle" aria-hidden="true">
          {evento.currency}
        </span>
        <span className="truncate">{evento.title}</span>
      </p>
      <p className="font-mono text-headline-sm tabular-nums text-accent-cyan">{faltan}</p>
    </div>
  )
}

interface Canal {
  codigo: string // identificador corto tipo terminal — a proposito sin traducir, mismo criterio
  // que CATEGORY_LABELS en Header.tsx (jerga de trading, igual en es/en "by existing design").
  href: string
  title: string
  body: string
  preview: React.ReactNode
}

// Una sola consola con 4 canales separados por lineas finas, no 4 tarjetas flotando sueltas —
// el sitio ya se llama a si mismo "Terminal" en el header; esto se parece a un panel real de
// varias columnas en vez del kit-de-tarjetas-SaaS generico (icono + titulo + cuerpo, todas con
// el mismo borde redondeado) de la version anterior.
function ColumnaTerminal({ canal, i, visible }: { canal: Canal; i: number; visible: boolean }) {
  return (
    <Link
      href={canal.href}
      className={clsx(
        'group flex h-full flex-col gap-4 px-5 py-6 transition-colors duration-200 hover:bg-white/[0.025]',
        visible ? 'hero-fade-up' : 'opacity-0'
      )}
      style={visible ? { animationDelay: `${i * 70}ms` } : undefined}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono text-micro">
        <span className="flex items-center gap-1.5 text-ink-muted transition-colors group-hover:text-accent-cyan">
          <span className="text-accent-cyan" aria-hidden="true">
            ❯
          </span>
          {canal.codigo}
        </span>
        <span className="splash-mark size-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
      </div>

      <div className="min-h-[108px] flex-1">{canal.preview}</div>

      <div>
        <h3 className="text-body-sm font-semibold text-ink">{canal.title}</h3>
        <p className="mt-1 text-micro text-ink-subtle">{canal.body}</p>
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

  const canales: Canal[] = [
    { codigo: 'NEWS', href: '/articulos', title: features.news.title, body: features.news.body, preview: <NoticiasRotator items={noticiasPreview} /> },
    { codigo: 'MKTS', href: '/markets', title: features.markets.title, body: features.markets.body, preview: <MercadosFilas items={cotizacionesPreview} locale={locale} /> },
    { codigo: 'PVT', href: '/pivot-points', title: features.pivots.title, body: features.pivots.body, preview: <PivoteEscalera datos={pivotePreview} locale={locale} /> },
    { codigo: 'CAL', href: '/calendario', title: features.calendar.title, body: features.calendar.body, preview: <CalendarioPreview /> },
  ]

  return (
    <div id="lo-que-hay-dentro" ref={sectionRef} className="scroll-mt-[var(--header-scroll-offset)]">
      <div className="section-container">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {/* Barra de estado: la unica pieza "audaz" del bloque — el resto se queda quieto y
              disciplinado debajo. Nada de titulo editorial tipo "Lo que hay dentro": esto lee
              como el encabezado de una consola real, no como un h2 decorativo. */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-2.5 font-mono text-[11px] text-ink-subtle">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
              GRIZZLY://TERMINAL
            </span>
            <span className="splash-mark text-accent-cyan" aria-hidden="true">
              ▊
            </span>
          </div>

          {/* Movil: carrusel horizontal con scroll-snap, un canal a la vez. */}
          <ul className="flex snap-x snap-mandatory divide-x divide-white/10 overflow-x-auto sm:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={features.title}>
            {canales.map((canal, i) => (
              <li key={canal.href} className="w-[82vw] shrink-0 snap-center">
                <ColumnaTerminal canal={canal} i={i} visible={visible} />
              </li>
            ))}
          </ul>

          {/* Tablet+: las 4 columnas side by side, separadas por hairlines — un panel, no 4
              cajas sueltas. */}
          <ul className="hidden sm:grid sm:grid-cols-2 sm:divide-x sm:divide-white/10 lg:grid-cols-4" aria-label={features.title}>
            {canales.map((canal, i) => (
              <li key={canal.href} className={clsx(i < 2 && 'sm:border-b sm:border-white/10 lg:border-b-0')}>
                <ColumnaTerminal canal={canal} i={i} visible={visible} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
