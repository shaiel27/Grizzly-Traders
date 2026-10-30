'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { clsx } from 'clsx'
import { ASSET_BY_PLAIN } from '@/lib/assets-catalog'
import { formatPrice } from '@/lib/format'
import { simboloNoticias, type Marcador } from '@/lib/globe/marcadores'
import type { Locale } from '@/lib/i18n/get-dictionary'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { obtenerNoticias, olvidarNoticias, type NoticiaActivo } from '@/lib/globe/noticias'

// Reexport del prefetch para GloboHolografico.tsx (hover de pin): el cache de promesas vive
// ahora en lib/globe/noticias.ts con los tests de regresion de F0-03, pero el punto de
// entrada publico no cambia.
export { precargarNoticias } from '@/lib/globe/noticias'

export interface PosicionPin {
  x: number
  y: number
  visible: boolean
}

// marcador.simbolo es el `plain` del catalogo (lib/assets-catalog.ts: 'XAUUSD', 'ES'...), pero el
// terminal indexa cada activo por su ticker de TradingView ('OANDA:XAUUSD'). Sin esa traduccion, el
// enlace "ver en terminal" nunca encuentra el activo en MarketsClient.tsx y cae al primero de la
// lista. Se deriva del catalogo (ASSET_BY_PLAIN), no de un mapa a mano.
function simboloTerminal(plain: string): string {
  return ASSET_BY_PLAIN.get(plain)?.tv ?? plain
}

// Mismo formateador que la terminal (formatPrice): "$" solo si el catalogo lo dice (los futuros de
// indices cotizan en puntos), y los mismos separadores y decimales en todas las tarjetas.
function precioTarjeta(precio: number, plain: string): string {
  const asset = ASSET_BY_PLAIN.get(plain)
  return formatPrice(precio, asset?.tv ?? plain, { currency: asset?.currency ?? false })
}

interface TarjetaActivoProps {
  marcador: Marcador
  locale: Locale
  cotizacion: { precio: number; cambio: number | null } | undefined
  posicionRef: MutableRefObject<PosicionPin>
  // false cuando el pin se abrio por hover: mover el foco ahi solo porque el mouse paso por
  // encima le robaria el foco a quien este navegando con teclado en otra parte de la pagina.
  autoenfocar: boolean
  onHover: (sobre: boolean) => void
  onCerrar: () => void
}

export function TarjetaActivo({ marcador, locale, cotizacion, posicionRef, autoenfocar, onHover, onCerrar }: TarjetaActivoProps) {
  const dict = getDictionary(locale)
  const divRef = useRef<HTMLDivElement>(null)
  const primerEnlaceRef = useRef<HTMLAnchorElement>(null)
  // F0-03: 'error' es un estado propio con copy y reintento — NO se fussiona con el [] del
  // "ok sin resultados", que es el unico caso que muestra globoSinNoticias.
  const [noticias, setNoticias] = useState<NoticiaActivo[] | 'cargando' | 'error'>('cargando')
  const [intentos, setIntentos] = useState(0)

  // Posicion: se proyecta cada frame dentro del Canvas (GloboHolografico.tsx, useFrame de
  // Escena) y se escribe en posicionRef sin pasar por React — este componente lee ese ref con
  // su propio requestAnimationFrame, mismo patron que el encogimiento del globo con el scroll
  // en HomeHero.tsx: mutar estilo via ref, nunca setState, para no re-renderizar 60 veces/s.
  useEffect(() => {
    let id = 0
    let fueraDesde = 0
    // Ultimos valores escritos en el DOM (F5): el pin seleccionado NO se mueve mientras la
    // tarjeta esta abierta (abrir pausa el auto-giro), asi que en la mayoria de los frames no
    // hay nada que tocar. Antes se reescribian transform/opacity/pointerEvents + su template
    // de string en CADA frame aunque el valor no hubiera cambiado.
    let ultimoX = Number.NaN
    let ultimoY = Number.NaN
    let ultimoVisible: boolean | null = null
    const paso = () => {
      id = requestAnimationFrame(paso)
      const p = posicionRef.current
      if (divRef.current && (p.x !== ultimoX || p.y !== ultimoY || p.visible !== ultimoVisible)) {
        ultimoX = p.x
        ultimoY = p.y
        ultimoVisible = p.visible
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
    // El unico setState sincronico a 'cargando' es al pulsar Reintentar (F0-03), que es un
    // evento de usuario y no un efecto.
    let cancelado = false
    obtenerNoticias(simboloNoticias(marcador), locale).then(
      (data) => {
        if (!cancelado) setNoticias(data)
      },
      () => {
        // F0-03: el fallo (HTTP !ok o red) no se cachea en lib/globe/noticias.ts y aqui
        // vuelve como rechazo — estado 'error' con copy propio y boton Reintentar, en vez
        // del engañoso "Sin noticias" permanente que cacheaba el bug original.
        if (!cancelado) setNoticias('error')
      }
    )
    return () => {
      cancelado = true
    }
  }, [marcador, locale, intentos])

  useEffect(() => {
    if (autoenfocar) primerEnlaceRef.current?.focus({ preventScroll: true })
  }, [autoenfocar])

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

  const positivo = (cotizacion?.cambio ?? 0) >= 0
  const nombre = dict.home.globoMarcadores[marcador.nombreClave as keyof typeof dict.home.globoMarcadores] ?? marcador.simbolo

  const botonReintentarRef = useRef<HTMLButtonElement>(null)
  // true si Reintentar tenia el foco al pulsarlo: al terminar el reintento exitoso el boton
  // desaparece y el foco se recuperara sobre el primer titular (si lo hay) en vez de caer al body.
  const enfocarTrasReintentoRef = useRef(false)

  const reintentarNoticias = () => {
    // F0-03: aunque el fallo ya no se cachea, olvidarNoticias garantiza que el re-lanzamiento
    // no puede reutilizar ninguna promesa en vuelo de la clave.
    olvidarNoticias(simboloNoticias(marcador), locale)
    enfocarTrasReintentoRef.current = document.activeElement === botonReintentarRef.current
    setNoticias('cargando')
    setIntentos((n) => n + 1)
  }

  // Tras un reintento exitoso, si el foco estaba en el boton (que ya no existe), devolverlo al
  // primer enlace — detalle invisible pero real: sin esto, un usuario de teclado pierde el foco
  // al body cuando el boton se desmonta con la lista.
  useEffect(() => {
    if (Array.isArray(noticias) && enfocarTrasReintentoRef.current) {
      enfocarTrasReintentoRef.current = false
      if (noticias.length > 0) primerEnlaceRef.current?.focus({ preventScroll: true })
    }
  }, [noticias])

  return (
    <div
      ref={divRef}
      role="dialog"
      aria-label={nombre}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      // F0-10: entrada con puente — opacity 0→1 (la escribe el rAF de arriba via style.opacity)
      // + scale 0.96→1 via la propiedad CSS `scale` (NO `transform`, que el rAF usa para
      // posicionar; en Tailwind v4 las utilidades scale usan la propiedad `scale` y componen
      // con translate). @starting-style da el estado inicial 96% en el primer frame y el
      // transition de 180ms --ease-out lo lleva al 100%: origin-bottom la ancla al pin.
      // Con prefers-reduced-motion el catch-all de globals.css colapsa la transicion a
      // opacity sola (150ms) y el scale salta estatico — comportamiento pedido.
      //
      // V1: placa solida, no glass. El backdrop-blur-md que vivia aqui apenas se percibia
      // detras de un fondo que ya tapaba el 88%, pero costaba una capa de composicion en cada
      // frame mientras el rAF de arriba mueve la tarjeta con el globo — y desentonaba: las
      // placas HUD del propio globo (crearTexturaEtiqueta, GloboHolografico.tsx:144) son
      // deliberadamente solidas con este mismo rgba(5,12,20,...). Al quitar el blur el alpha
      // sube 0.88→0.93 para devolverle cuerpo: menos sangrado del canvas de detras y, de paso,
      // mas contraste del texto (ver nota de F0-22 mas abajo). Ojo: (5,12,20) NO es
      // --globe-base (#020a18, la base del material del globo) — es el gris-azul de las placas
      // y no tiene token porque su otro uso es un fillStyle de canvas 2D, que no resuelve
      // var(). El borde accent-cyan/30 es estructural (define el canto de la placa) y se queda.
      className="absolute left-0 top-0 z-20 w-[260px] origin-bottom scale-100 -translate-x-1/2 rounded-2xl border border-accent-cyan/30 bg-[rgba(5,12,20,0.93)] p-4 opacity-0 transition-[opacity,scale] duration-[180ms] ease-[var(--ease-out)] starting:scale-[96%]"
      // V1: la sombra ya no es un aura. El '0 0 40px rgba(79,195,255,0.15)' era un glow difuso
      // sin direccion que leia como halo generico y no asentaba la tarjeta sobre la escena;
      // ahora hay profundidad real (offset de 8px, negro al 45%) mas un halo de acento minimo
      // al 8% que solo insinua el canto emisivo. El cian va como color-mix sobre
      // var(--accent-cyan), la convencion del repo para el acento con alpha arbitrario
      // (HomeHero.tsx:176-180, VipShowcase.tsx:118); --accent-cyan-glow no sirve porque esta
      // fijado al 25%. El negro queda literal, igual que las sombras de ArticleCard/Card.
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 8px color-mix(in srgb, var(--accent-cyan) 8%, transparent)' }}
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

      {/* F0-12: la fila se renderiza SIEMPRE — sin snapshot, el precio es "—" con aria-label
          que explica la ausencia, y el delta tambien "—" pero sin flecha (no hay direccion
          que mostrar). El toLocaleString del precio formateado no cambia. */}
      <p className="mt-2 flex items-baseline gap-2 font-mono text-body">
        <span
          className="text-ink"
          aria-label={cotizacion ? undefined : dict.home.globoCotizacionNoDisponible}
        >
          {cotizacion ? precioTarjeta(cotizacion.precio, marcador.simbolo) : '—'}
        </span>
        <span
          className={clsx(
            'text-micro',
            cotizacion?.cambio == null ? 'text-ink-subtle' : positivo ? 'text-semantic-success' : 'text-semantic-danger'
          )}
        >
          {cotizacion?.cambio == null ? '—' : `${positivo ? '▲' : '▼'} ${Math.abs(cotizacion.cambio).toFixed(2)}%`}
        </span>
      </p>

      <div className="mt-3 border-t border-white/10 pt-3">
        {noticias === 'cargando' && (
          // F0-17: skeleton como status anunciable (convencion del repo: MarketsClient,
          // PivotAssetPanel…) y sin pulso bajo reduced-motion.
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 animate-pulse motion-reduce:animate-none rounded bg-white/10" style={{ width: `${80 - i * 15}%` }} />
            ))}
          </div>
        )}
        {noticias === 'error' && (
          <div role="status" aria-live="polite" className="flex flex-col items-start gap-2">
            <p className="text-micro text-ink-muted">{dict.home.globoErrorNoticias}</p>
            <button
              ref={botonReintentarRef}
              type="button"
              onClick={reintentarNoticias}
              // Feedback de pulsacion (emil-design-eng): scale 0.97 a 160ms --ease-out, el
              // mismo trato que cualquier boton presionable del repo. En Tailwind v4
              // active:scale-* escribe la propiedad CSS `scale`, por eso va en la lista de
              // la transicion y no `transform`.
              className="rounded-md border border-white/15 px-2.5 py-1 text-micro text-ink-muted transition-[scale,background-color,color] duration-[160ms] ease-[var(--ease-out)] hover:border-white/25 hover:bg-white/5 hover:text-ink active:scale-[0.97]"
            >
              {dict.home.globoReintentar}
            </button>
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
                  {/* F0-22: 10px ink-subtle (4.8:1 sobre la tarjeta) → 11px ink-muted (≈7:1):
                      la fecha es metadata que aun se tiene que leer, no decoracion.
                      V1 recalcula ese ≈7:1 con el fondo al 0.93: ink-muted queda en 6.9:1 y
                      ink-subtle (el '—' del delta y globoSinNoticias) en 5.0:1 sobre el fondo
                      efectivo; en el peor caso imaginable —glow cian a plena luz justo detras—
                      6.3:1 y 4.5:1, antes 5.7:1 y 4.1:1. Subir el alpha solo mejoro el
                      contraste, nunca lo empeora. */}
                  <span className="mt-0.5 block text-[11px] text-ink-muted">{n.fecha}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-micro">
        <Link href={`/markets?activo=${encodeURIComponent(simboloTerminal(marcador.simbolo))}`} className="font-medium text-accent-cyan hover:underline">
          {dict.home.globoVerTerminal}
        </Link>
        {/* Filtro por activo (el del indice, no el del contrato), igual que el panel de la terminal */}
        <Link href={`/articulos?activo=${encodeURIComponent(simboloNoticias(marcador))}`} className="text-ink-muted hover:text-ink hover:underline">
          {dict.home.globoTodasNoticias}
        </Link>
      </div>
    </div>
  )
}
