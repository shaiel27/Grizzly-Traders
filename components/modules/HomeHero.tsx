'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui'
import { HeroGlobe } from '@/components/globe/HeroGlobe'
import type { DatosGlobo } from '@/components/globe/GloboHolografico'
import { HomeFeatures, type NoticiaPreview, type CotizacionPreview, type PivotePreview } from './HomeFeatures'
import { useIntroInicio } from './useIntroInicio'
import { FondoHero } from '@/components/globe/FondoHero'
import { LeyendaGlobo } from '@/components/globe/LeyendaGlobo'
import { estadoSesiones, type EstadoSesion } from '@/lib/globe/sesiones'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'
import { scrollSuaveA } from '@/lib/scroll'
import type { PriceData } from '@/lib/prices'
import type { ResultadoSentimiento } from '@/lib/globe/sentimiento'

// Caja del globo: la usan la caja real (cajaRef) y su hueco de destino de la intro (destinoRef),
// que debe ocupar exactamente lo mismo — es el tamaño de reposo dentro de la columna del grid
// (plan 009 B6), no una posicion absoluta: la intro saca a cajaRef del flujo via [data-globo-caja]
// en globals.css (position:absolute, sin importar estas clases) mientras dura, y estas clases
// solo definen el tamaño/posicion de reposo antes y despues de la intro.
const CLASES_CAJA_GLOBO = 'aspect-square w-[88vw] max-w-[420px] lg:w-full lg:max-w-[min(78vh,720px)]'

interface HomeHeroProps {
  locale: Locale
  postCount: number
  assetCount: number
  btcPrice: PriceData | null
  noticiasPreview: NoticiaPreview[]
  cotizacionesPreview: CotizacionPreview[]
  pivotePreview: PivotePreview | null
  cotizacionesGlobo: Record<string, { precio: number; cambio: number | null }>
  riesgo: ResultadoSentimiento | null
  sentimientoPorRegion: Record<number, number>
}

export function HomeHero({
  locale,
  postCount,
  assetCount,
  btcPrice,
  noticiasPreview,
  cotizacionesPreview,
  pivotePreview,
  cotizacionesGlobo,
  riesgo,
  sentimientoPorRegion,
}: HomeHeroProps) {
  const dict = getDictionary(locale).home
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
  // El texto espera a que el globo avise que esta listo (o a su propio timeout de 2s si WebGL
  // tarda/falla) para que ambos arranquen su secuencia de entrada juntos, en vez de que el
  // texto aparezca mientras el canvas todavia esta cargando.
  const [listo, setListo] = useState(false)

  // Estado de sesiones del mercado (plan 009 §2): se recalcula cada 30s, no en cada frame — es
  // la hora, no algo que necesite 60fps. Arranca vacio (nada de Date.now() en el render, la
  // regla react-hooks/purity) y se llena en un efecto, despues de montar.
  const [estadosSesion, setEstadosSesion] = useState<EstadoSesion[]>([])
  useEffect(() => {
    const actualizar = () => setEstadosSesion(estadoSesiones(new Date()))
    actualizar()
    const id = setInterval(actualizar, 30_000)
    return () => clearInterval(id)
  }, [])

  // Encogimiento del globo con el scroll: muta el estilo via ref (nunca state), igual que el
  // resto de las animaciones de components/globe/* — evita re-renderizar HomeHero 60 veces
  // por segundo solo para escalar un div.
  const globoEscalaRef = useRef<HTMLDivElement>(null)

  // Intro de primera carga (ver useIntroInicio.ts y el bloque "Intro" de globals.css)
  const pistaRef = useRef<HTMLDivElement>(null)
  const cajaRef = useRef<HTMLDivElement>(null)
  const destinoRef = useRef<HTMLDivElement>(null)
  const textoRef = useRef<HTMLDivElement>(null)
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const refsIntro = useMemo(
    () => ({ pista: pistaRef, caja: cajaRef, destino: destinoRef, texto: textoRef, titulo: tituloRef }),
    []
  )
  useIntroInicio(refsIntro)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    // window.innerHeight cambia en movil cuando la barra del navegador se esconde/muestra AL
    // HACER SCROLL — no es un resize real. Leerlo en cada tick de scroll (como antes) hacia que
    // la escala del globo saltara sola. Se mide una vez y solo se vuelve a medir si el ANCHO
    // cambia de verdad (giro de pantalla, cambio de ventana) — plan 009 B12.
    let alturaRef = window.visualViewport?.height ?? window.innerHeight ?? 800
    let anchoAnterior = window.innerWidth

    let pidiendoFrame = false
    const actualizar = () => {
      pidiendoFrame = false
      // Durante la intro el tamaño/posicion del globo los lleva useIntroInicio (transform en
      // cajaRef); este encogimiento por scroll empieza recien cuando la intro termina, si no
      // ambas animaciones pelean por el mismo transform visual.
      const progreso =
        document.documentElement.dataset.intro === 'activo' ? 0 : Math.min(1, Math.max(0, window.scrollY / (alturaRef * 0.85)))
      const escala = 1 - progreso * 0.32
      if (globoEscalaRef.current) globoEscalaRef.current.style.transform = `scale(${escala})`
    }
    const onScroll = () => {
      if (pidiendoFrame) return
      pidiendoFrame = true
      requestAnimationFrame(actualizar)
    }
    const onResize = () => {
      if (window.innerWidth === anchoAnterior) return
      anchoAnterior = window.innerWidth
      alturaRef = window.visualViewport?.height ?? window.innerHeight ?? 800
      actualizar()
    }

    actualizar()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // "Ver mas": scroll animado (lib/scroll.ts) con destino recalculado en vivo, en vez del
  // <a href="#..."> nativo — en Windows con "reducir movimiento" activado (muy comun sin que el
  // usuario lo sepa) el catch-all de globals.css vuelve el scroll nativo instantaneo (plan 009
  // B1). preventDefault() evita que el navegador agregue el hash a la URL de entrada (B11); sin
  // JS, el enlace nativo sigue funcionando igual.
  const irAFeatures = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const destino = document.getElementById('lo-que-hay-dentro')
    if (!destino) return
    e.preventDefault()
    scrollSuaveA(destino, {
      onTerminar: () => destino.querySelector<HTMLElement>('a')?.focus({ preventScroll: true }),
    })
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  const price = btcPrice?.price ?? null
  const changePercent = btcPrice?.changePercent24h ?? 0

  const datosGlobo: DatosGlobo = {
    precioBtc: price !== null ? price.toLocaleString(numberLocale, { maximumFractionDigits: 0 }) : '—',
    deltaBtc: price !== null ? Math.abs(changePercent).toFixed(1) : '—',
    deltaPositivo: changePercent >= 0,
    posts: postCount,
    assets: assetCount,
    etiquetaNoticias: `${postCount.toLocaleString(numberLocale)} ${dict.globeLabelNoticias}`,
    etiquetaActivos: `${assetCount.toLocaleString(numberLocale)} ${dict.globeLabelActivos}`,
    cotizacionesPines: cotizacionesGlobo,
    sentimientoPorRegion,
  }

  return (
    <section className="relative isolate overflow-clip bg-black" aria-label={dict.heroSectionAria}>
      {/* Fondo de TODA la seccion (hero + tarjetas, que viven en la misma <section>), no solo el
          cuadrado del Canvas del globo — antes el campo de estrellas vivia dentro de ese Canvas
          y en pantallas anchas se notaba su borde recto contra el negro liso de alrededor (plan
          009 B4). Canvas 2D aparte: no compite por GPU/contexto con el globo. overflow-clip (no
          -hidden): durante la intro la escena queda `position:sticky` (useIntroInicio.ts) y
          overflow:hidden convertiria a esta seccion en el contenedor de scroll del sticky,
          rompiendolo. */}
      <FondoHero />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div
          className="hero-glow-a absolute -left-[10%] -top-[15%] size-[55vw] max-w-[640px] rounded-full blur-[110px]"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--gradient-violet) 55%, transparent) 0%, transparent 70%)' }}
        />
        <div
          className="hero-glow-b absolute -bottom-[20%] -right-[8%] size-[50vw] max-w-[560px] rounded-full blur-[110px]"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 45%, transparent) 0%, transparent 70%)' }}
        />
      </div>
      {/* Difuminado hacia la siguiente seccion (plan 009 B5/§10.4): antes el corte entre este
          negro puro y --canvas (#090909) era brusco. Mismo tramo que la mascara de FondoHero,
          para que las estrellas se apaguen justo donde el color empieza a virar, no antes. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[140px] bg-gradient-to-b from-transparent to-[var(--canvas)] md:h-[220px]" />

      {/* Intro de primera carga (useIntroInicio.ts): la pista da el recorrido de scroll
          (espaciador) mientras la escena queda sticky, asi el globo puede ocupar la pantalla
          completa al entrar y encogerse hasta su sitio real (destinoRef, dentro del grid de
          abajo) a medida que se hace scroll. flow-root evita que el padding-top de la zona util
          se escape de la escena sticky. Sin intro (segunda visita, reduced-motion) pistaRef y la
          escena son divs normales, sin efecto. */}
      <div ref={pistaRef} data-intro-pista>
        <div data-intro-escena className="relative flow-root">
          {/* Grid de 2 columnas en vez de dos bloques `position:absolute` independientes (plan 009
              B6): a 1280-1366px el texto (antes max-w-2xl desde la izquierda) y el globo (antes
              left-60%) llegaban a solaparse — con columnas de verdad eso es estructuralmente
              imposible. De paso se borra el truco de `pointer-events-none` en el texto: sin
              superposicion, no hace falta "agujerear" el texto para que el arrastre del globo
              llegue. mt- en vez de pt- (containing block de un absoluto = padding box del
              ancestro): ya no aplica aqui porque nada adentro es `absolute` por clase (cajaRef lo
              es solo durante la intro, via [data-globo-caja] en globals.css) — se mantiene el
              mismo override a --header-h-real para no regresar al numero fijo. */}
          <div className="relative z-10 mx-auto grid min-h-[calc(100svh_-_var(--header-h-real,var(--header-height)))] max-w-[1320px] grid-cols-1 items-center gap-8 px-6 pb-12 pt-[var(--header-h-real,var(--header-height))] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10 lg:px-10 lg:pb-0">
            <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
              {/* textoRef se traslada como bloque durante la intro (useIntroInicio.ts mide
                  tituloRef adentro para calcular ese desplazamiento) */}
              <div ref={textoRef} data-intro-texto>
                {/* Chip "en vivo": chrome neutro de vidrio — el cian se reserva para el globo y las
                    tarjetas de abajo, no compite por atencion con el titular. */}
                <p
                  className={clsx(
                    'mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-micro uppercase tracking-[0.1em] text-ink-muted',
                    listo ? 'hero-fade-up' : 'opacity-0'
                  )}
                  style={listo ? { animationDelay: '0ms' } : undefined}
                >
                  <span className="splash-mark size-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
                  {dict.heroLiveKicker}
                </p>
                {/* display-xl (85px) partia el titulo en una palabra por linea en esta columna —
                    display-lg (62px) es el techo ahora. tracking mas cerrado: sensacion mas bold.
                    lg:w-fit: useIntroInicio.ts mide el ancho real del h1 para centrarlo durante la
                    intro — sin esto mediria el ancho de la columna entera, no el del texto. */}
                <h1
                  ref={tituloRef}
                  className={clsx(
                    'text-display-lg-mobile font-bold tracking-[-0.02em] text-ink sm:text-display-lg lg:w-fit',
                    listo ? 'hero-fade-up' : 'opacity-0'
                  )}
                  style={listo ? { animationDelay: '100ms' } : undefined}
                >
                  <span className="block">{dict.heroTitleLine1}</span>
                  <span className="block">{dict.heroTitleLine2}</span>
                </h1>
                {/* data-intro-resto (y el de mas abajo): durante la intro esto queda en opacity:0
                    hasta el ultimo tramo del scroll (ver --intro-resto en globals.css/useIntroInicio.ts)
                    — viaja pegado a textoRef asi que se traslada junto con el titulo, pero no se ve
                    hasta que el titulo ya esta cerca de su posicion final. Sin este wrapper (bug real
                    encontrado al verificar visualmente la intro con Playwright) aparecia de entrada,
                    superpuesto al globo a pantalla completa y al titulo gigante. */}
                <div data-intro-resto>
                  <p className={clsx('mt-5 max-w-md text-body text-on-surface-variant', listo ? 'hero-fade-up' : 'opacity-0')} style={listo ? { animationDelay: '220ms' } : undefined}>
                    {dict.heroLead}
                  </p>
                  {/* Pastilla en vez de linea de texto suelta: ahora se lee como una pista de uso,
                      no como otro renglon de copy. */}
                  <p
                    className={clsx(
                      'mt-4 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.03] px-3 py-1.5 font-mono text-micro text-ink-muted',
                      listo ? 'hero-fade-up' : 'opacity-0'
                    )}
                    style={listo ? { animationDelay: '340ms' } : undefined}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 1.5 L8 11.5 M8 1.5 L5 4.5 M8 1.5 L11 4.5 M3 9 C3 12.5 5.2 14.5 8 14.5 C10.8 14.5 13 12.5 13 9"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {dict.heroDragHint}
                  </p>
                </div>
              </div>

              <div data-intro-resto>
                <div
                  className={clsx('mt-7 flex flex-wrap justify-center gap-3 lg:justify-start', listo ? 'hero-fade-up' : 'opacity-0')}
                  style={listo ? { animationDelay: '460ms' } : undefined}
                >
                  <Button variant="primary" size="lg" className="whitespace-nowrap" asChild>
                    <Link href="/articulos">{dict.heroCtaPrimary}</Link>
                  </Button>
                  <Button variant="secondary" size="lg" className="whitespace-nowrap" asChild>
                    <a href="#lo-que-hay-dentro" onClick={irAFeatures}>
                      {dict.heroCtaMore}
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Techo un poco mas chico que antes (780px/82vh -> 720px/78vh): con columnas reales ya
                no hace falta exprimir el maximo posible para "llenar" el lado derecho. destinoRef
                reserva el espacio de esta columna con las mismas clases que la caja real
                (CLASES_CAJA_GLOBO): durante la intro cajaRef sale del flujo normal (position:
                absolute via [data-globo-caja] en globals.css) para ocupar la pantalla, y
                destinoRef sostiene el hueco para que nada salte de lugar al terminar. */}
            <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
              <div ref={destinoRef} data-globo-destino aria-hidden="true" className={clsx(CLASES_CAJA_GLOBO, 'invisible pointer-events-none')} />
              <div ref={cajaRef} data-globo-caja className={CLASES_CAJA_GLOBO}>
                <div ref={globoEscalaRef} className="relative size-full" style={{ willChange: 'transform' }}>
                  {/* Halo detras del globo (plan 009 §10.3): vive dentro del mismo wrapper que se
                      escala con el scroll, asi se encoge junto con el globo sin logica aparte.
                      Reusa la respiracion de .splash-mark (ya definida en globals.css) en vez de un
                      keyframe nuevo solo para esto. */}
                  <div
                    aria-hidden="true"
                    className="splash-mark pointer-events-none absolute -inset-[8%] -z-10 rounded-full blur-[60px]"
                    style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 30%, transparent) 0%, transparent 72%)' }}
                  />
                  <HeroGlobe datos={datosGlobo} ariaLabel={dict.globeAria} locale={locale} estadosSesion={estadosSesion} onReady={() => setListo(true)} />
                </div>
              </div>
              {/* Debajo de la intro, con el resto del texto secundario (data-intro-resto): la leyenda
                  no tiene sentido mientras el globo todavia esta a pantalla completa. */}
              <div data-intro-resto>
                <LeyendaGlobo estados={estadosSesion} riesgo={riesgo} locale={locale} />
              </div>
            </div>
          </div>
        </div>
        <div data-intro-espaciador aria-hidden="true" />
      </div>

      {/* Pista "desliza para explorar": solo existe durante la intro (data-intro-solo) */}
      <div
        data-intro-solo
        className="fixed inset-x-0 bottom-6 z-30 flex justify-center"
        style={{ opacity: 'var(--intro-cue, 1)' }}
      >
        <button
          type="button"
          onClick={() => {
            const espaciador = pistaRef.current?.querySelector<HTMLElement>('[data-intro-espaciador]')
            window.scrollTo({ top: espaciador?.offsetHeight || window.innerHeight, behavior: 'smooth' })
          }}
          className={clsx(
            'flex flex-col items-center gap-1.5 rounded-full px-4 py-2 font-mono text-micro uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-accent-cyan',
            listo ? 'hero-fade-up' : 'opacity-0'
          )}
          style={listo ? { animationDelay: '700ms' } : undefined}
        >
          {dict.introScrollHint}
          <svg className="intro-cue-flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Tarjetas de "Lo que hay dentro", ahora dentro de la misma seccion del globo (sin
          titulo ni CTA aparte — se pidio quitarlos) en vez de una seccion propia debajo. Sin
          padding horizontal aca: HomeFeatures ya trae su propio section-container (16/20px +
          max-w-1200), duplicarlo sumaria padding de mas en mobile. */}
      <div className="relative z-10 pb-16 pt-4 md:pb-24">
        <HomeFeatures locale={locale} noticiasPreview={noticiasPreview} cotizacionesPreview={cotizacionesPreview} pivotePreview={pivotePreview} />
      </div>
    </section>
  )
}
