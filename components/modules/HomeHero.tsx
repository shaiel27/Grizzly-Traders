'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui'
import { HeroGlobe } from '@/components/globe/HeroGlobe'
import type { DatosGlobo } from '@/components/globe/GloboHolografico'
import { HomeFeatures } from './HomeFeatures'
import { useIntroInicio } from './useIntroInicio'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'
import type { PriceData } from '@/lib/prices'

// Caja del globo: la usan la caja real y su hueco de destino de la intro, que debe ocupar exactamente lo mismo
const CLASES_CAJA_GLOBO =
  'aspect-square w-[88vw] max-w-[420px] shrink-0 lg:absolute lg:left-[60%] lg:top-1/2 lg:w-[min(82vh,780px)] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2'

interface HomeHeroProps {
  locale: Locale
  postCount: number
  assetCount: number
  btcPrice: PriceData | null
}

export function HomeHero({ locale, postCount, assetCount, btcPrice }: HomeHeroProps) {
  const dict = getDictionary(locale).home
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
  // El texto espera a que el globo avise que esta listo (o a su propio timeout de 2s si WebGL
  // tarda/falla) para que ambos arranquen su secuencia de entrada juntos, en vez de que el
  // texto aparezca mientras el canvas todavia esta cargando.
  const [listo, setListo] = useState(false)

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

    let pidiendoFrame = false
    const actualizar = () => {
      pidiendoFrame = false
      const alto = window.innerHeight || 800
      // Durante la intro el tamaño del globo lo lleva useIntroInicio; este encogimiento empieza despues
      const progreso =
        document.documentElement.dataset.intro === 'activo' ? 0 : Math.min(1, Math.max(0, window.scrollY / (alto * 0.85)))
      const escala = 1 - progreso * 0.32
      if (globoEscalaRef.current) globoEscalaRef.current.style.transform = `scale(${escala})`
    }
    const onScroll = () => {
      if (pidiendoFrame) return
      pidiendoFrame = true
      requestAnimationFrame(actualizar)
    }
    actualizar()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
  }

  return (
    <section className="relative isolate overflow-clip bg-black" aria-label={dict.heroSectionAria}>
      {/* Fondo: el campo de estrellas vive DENTRO del Canvas del globo (components/globe/
          GloboHolografico.tsx, <CampoEstrellas>) — gira en el tiempo con el mismo render
          pipeline, no es un patron CSS estatico aparte. Aqui solo quedan 2 glows de esquina
          para que el negro fuera del canvas (los bordes en mobile) no quede absolutamente
          plano. La seccion ya es bg-black de punta a punta, igual que "Lo que hay dentro" —
          sin costura que disimular. */}
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

      {/* Zona util: todo lo que queda DEBAJO del header fijo, alto minimo = 1 viewport. Usa
          margin-top (no padding-top): el globo/texto de adentro son `lg:absolute` y su
          containing block es LA CAJA DE ESTE DIV — con padding-top, ese "top" se mide desde
          afuera del padding (el contenido quedaba muy arriba, detras del header). Con
          margin-top la caja entera se corre hacia abajo y el `top:50%` de adentro sigue dando
          el centro real de esta zona. Ya no es `position:absolute` (como antes, pegado al
          viewport): ahora esta en flujo normal para que las tarjetas de abajo puedan seguirlo
          dentro de la misma seccion, en vez de vivir en una seccion aparte. */}
      {/* Intro de primera carga: la pista da el recorrido de scroll (espaciador) y la escena queda sticky
          mientras tanto (solo con html[data-intro], ver globals.css). flow-root evita que el margin-top de la
          zona se escape de la escena. La seccion usa overflow-clip y no -hidden: overflow:hidden la
          convertiria en el contenedor de scroll del sticky y la escena dejaria de quedarse fija. */}
      <div ref={pistaRef} data-intro-pista>
        <div data-intro-escena className="relative flow-root">
          <div className="relative z-10 mt-[var(--header-height)] flex min-h-[calc(100svh_-_var(--header-height))] flex-col items-center px-6 pb-12 lg:block lg:px-0 lg:pb-0">
            {/* Mas grande que antes (680px -> 780px tope) — con left-[60%] el borde derecho sigue
                con margen hasta ~1070px de diametro, asi que 780 no se recorta en 1440px. */}
            <div ref={destinoRef} data-globo-destino aria-hidden="true" className={clsx(CLASES_CAJA_GLOBO, 'invisible pointer-events-none')} />
            <div ref={cajaRef} data-globo-caja className={CLASES_CAJA_GLOBO}>
              <div ref={globoEscalaRef} className="size-full" style={{ willChange: 'transform' }}>
                <HeroGlobe datos={datosGlobo} ariaLabel={dict.globeAria} onReady={() => setListo(true)} />
              </div>
            </div>

            <div className="relative z-10 mt-6 flex w-full max-w-2xl flex-col items-center text-center lg:absolute lg:inset-x-0 lg:bottom-12 lg:mt-0 lg:items-start lg:pl-[max(24px,calc((100vw-1200px)/2))] lg:text-left">
              {/* pointer-events-none: el texto nunca debe tapar el arrastre del globo que tiene detras */}
              <div ref={textoRef} data-intro-texto className="pointer-events-none">
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
                    display-lg (62px) es el techo ahora. tracking mas cerrado: sensacion mas bold. */}
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
                {/* Lo secundario espera al final de la intro: en la pantalla inicial solo van el globo y el titulo */}
                <div data-intro-resto>
                  <p
                    className={clsx('mt-5 max-w-md text-body text-on-surface-variant', listo ? 'hero-fade-up' : 'opacity-0')}
                    style={listo ? { animationDelay: '220ms' } : undefined}
                  >
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
                  className={clsx(
                    'pointer-events-auto mt-7 flex flex-wrap justify-center gap-3 lg:justify-start',
                    listo ? 'hero-fade-up' : 'opacity-0'
                  )}
                  style={listo ? { animationDelay: '460ms' } : undefined}
                >
                  <Button variant="primary" size="lg" className="whitespace-nowrap" asChild>
                    <Link href="/articulos">{dict.heroCtaPrimary}</Link>
                  </Button>
                  <Button variant="secondary" size="lg" className="whitespace-nowrap" asChild>
                    <a href="#lo-que-hay-dentro">{dict.heroCtaMore}</a>
                  </Button>
                </div>
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
        <HomeFeatures locale={locale} />
      </div>
    </section>
  )
}
