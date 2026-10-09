import type { Metadata } from 'next'
import Link from 'next/link'
import { BreakingPost, NewsGrid } from '@/components/ui'
import { HomeHero, LatestByCategory } from '@/components/modules'
import { PivotShowcase, type ActivoPivote } from '@/components/modules/PivotShowcase'
import { VipShowcase } from '@/components/modules/VipShowcase'
import {
  getPublishedPosts,
  getFeaturedPosts,
  getPostsByCategory,
  getPostCount,
  getAssets,
  withFreshViewCounts,
} from '@/lib/api'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary, t } from '@/lib/i18n/get-dictionary'
import { getCachedPrices, type PriceData } from '@/lib/prices'
import { getTickerSnapshot } from '@/lib/ticker'
import { getPivotQuotes } from '@/lib/pivot-data'
import { calculatePivots } from '@/lib/pivots'
import { localizedPost, sentimentMeta, timeAgo } from '@/lib/feed'
import { scanTradingView } from '@/lib/markets'
import { calcularSentimiento, normalizarCambio, type ResultadoSentimiento } from '@/lib/globe/sentimiento'
import type { PostWithRelations } from '@/lib/types'
import type { NoticiaPreview, CotizacionPreview, PivotePreview } from '@/components/modules/HomeFeatures'

// No estan en lib/ticker.ts (confirmado: esa lista cubre SPX/DAX/NIKKEI/FTSE/VIX pero no China
// ni Australia) — se piden aparte, solo el % del dia, para el score de sentimiento del globo
// (plan 009 §3.1, decision D3: SSE + XJO).
const GLOBE_EXTRA = [
  { symbol: 'SSE', tv: 'TVC:SHCOMP' },
  { symbol: 'XJO', tv: 'TVC:XJO' },
] as const

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  return { description: getDictionary(locale).home.metaDescription }
}

const CATEGORY_SLUGS = ['criptomonedas', 'forex', 'materias-primas', 'acciones']

const VIP_URL = process.env.NEXT_PUBLIC_VIP_URL
const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL

// Rolling last 24h instead of a UTC calendar-day cutoff, so the section doesn't go empty right after midnight UTC
function last24hIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const params = await searchParams
  const category = params.categoria ?? ''
  const locale = await getServerLocale()
  const dict = getDictionary(locale)

  let featured: PostWithRelations | undefined
  let latest: PostWithRelations[] = []
  const categoryPosts: Record<string, PostWithRelations[]> = {}
  let postCount = 0
  let assetCount = 0
  let sourceDown = false

  const last24h = last24hIso()

  // Separate from the posts try/catch below on purpose: a price-provider hiccup shouldn't
  // flip the whole page into sourceDown — the hero just falls back to "—" for that one figure.
  const btcPrice: PriceData | null = await getCachedPrices()
    .then((prices) => prices.find((p) => p.symbol === 'BTC') ?? null)
    .catch(() => null)

  try {
    const [featuredPosts, latestPosts, postsByCategory, count, assets] = await Promise.all([
      getFeaturedPosts(1, locale),
      getPublishedPosts({ since: last24h, limit: 60, categorySlug: category || undefined, locale }),
      Promise.all(CATEGORY_SLUGS.map((slug) => getPostsByCategory(slug, 3, locale))),
      getPostCount(),
      getAssets(),
    ])

    featured = featuredPosts[0]
    latest = latestPosts
    postCount = count
    assetCount = assets.length

    CATEGORY_SLUGS.forEach((slug, i) => {
      categoryPosts[slug] = postsByCategory[i]
    })

    // getPublishedPosts/getPostsByCategory/getFeaturedPosts are cached for 5 minutes — view_count
    // on the posts they return can lag behind real visits by that long. Overwrite it with a live
    // read in one batched query, so the displayed counts and the "Más vistas hoy" sort are accurate.
    const uniqueByid = <T extends { id: string }>(items: T[]) => items.filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
    const fresh = await withFreshViewCounts(uniqueByid([...(featured ? [featured] : []), ...latest, ...postsByCategory.flat()]))
    const freshById = new Map(fresh.map((p) => [p.id, p]))
    if (featured) featured = freshById.get(featured.id) ?? featured
    latest = latest.map((p) => freshById.get(p.id) ?? p)
    for (const slug of Object.keys(categoryPosts)) {
      categoryPosts[slug] = categoryPosts[slug].map((p) => freshById.get(p.id) ?? p)
    }
  } catch {
    sourceDown = true
  }

  // Vistas previas de "Lo que hay dentro" (plan 009 §12): datos reales ya cacheados en el
  // servidor, sin pedidos de mas. Separado del try/catch de arriba a proposito, mismo criterio
  // que btcPrice — si el ticker o los pivotes fallan, esas 2 tarjetas simplemente no muestran
  // vista previa, no tumban el resto de la home.
  const noticiasPreview: NoticiaPreview[] = latest.slice(0, 3).map((post) => {
    const { title, slug } = localizedPost(post, locale)
    const sentimiento = sentimentMeta(post.sentiment, locale)
    return { titulo: title, href: `/articulos/${slug}`, sentimientoLabel: sentimiento.label, sentimientoClase: sentimiento.chip, fecha: timeAgo(post.published_at, locale) }
  })

  // Un solo pedido al snapshot del ticker (ya cacheado 15s, lib/ticker.ts) alimenta tanto la
  // vista previa de "Terminal de mercados" como los pines de materias primas del globo (plan
  // 009 §1.4) — cubre BRENT/WTI/XAUUSD/XAGUSD/NG sin pedidos nuevos, ya estaban en TICKER_ASSETS.
  let cotizacionesPreview: CotizacionPreview[] = []
  let cotizacionesGlobo: Record<string, { precio: number; cambio: number | null }> = {}
  try {
    const snap = await getTickerSnapshot()
    const porSimbolo = new Map(snap.quotes.map((q) => [q.symbol, q]))
    cotizacionesPreview = ['BTC', 'XAUUSD', 'SPX']
      .map((s) => porSimbolo.get(s))
      .filter((q): q is NonNullable<typeof q> => q != null)
      .map((q) => ({ simbolo: q.symbol, label: q.label, precio: q.price, cambio: q.changePercent, moneda: q.currency }))
    cotizacionesGlobo = Object.fromEntries(snap.quotes.map((q) => [q.symbol, { precio: q.price, cambio: q.changePercent }]))
  } catch {
    // cotizacionesPreview/cotizacionesGlobo se quedan vacios — las tarjetas/pines que los usan
    // simplemente no muestran precio, no tumban el resto de la home.
  }

  // Score risk-on/risk-off del globo (plan 009 §3.1): se completa China/Australia aparte
  // (no estan en el ticker) y se delega el calculo a una funcion pura y testeada
  // (lib/globe/sentimiento.ts), nunca inline aca.
  let riesgo: ResultadoSentimiento | null = null
  // Mapa region->score para el mapa de calor del globo (plan 009 §3.2): mismas regiones que
  // scripts/build-globe-mask.mjs (1 EE.UU./SPX, 2 Eurozona/DAX, 3 Reino Unido/FTSE, 4 Japon/NIKKEI,
  // 5 China/SSE, 6 Australia/XJO). Si falta un dato, normalizarCambio(null) da 0 — ese continente
  // simplemente se queda sin tiñe, no rompe el resto del mapa.
  let sentimientoPorRegion: Record<number, number> = {}
  try {
    const filas = await scanTradingView(GLOBE_EXTRA.map((a) => a.tv), ['change'])
    const porTicker = new Map(filas.map((f) => [f.s, f.d]))
    const cambioDe = (tv: string) => {
      const d = porTicker.get(tv)
      const v = d?.[0]
      return typeof v === 'number' ? v : null
    }
    const sse = cambioDe('TVC:SHCOMP')
    const xjo = cambioDe('TVC:XJO')
    riesgo = calcularSentimiento({
      spx: cotizacionesGlobo.SPX?.cambio ?? null,
      dax: cotizacionesGlobo.DAX?.cambio ?? null,
      nikkei: cotizacionesGlobo.NIKKEI?.cambio ?? null,
      ftse: cotizacionesGlobo.FTSE?.cambio ?? null,
      sse,
      vix: cotizacionesGlobo.VIX?.cambio ?? null,
    })
    sentimientoPorRegion = {
      1: normalizarCambio(cotizacionesGlobo.SPX?.cambio ?? null),
      2: normalizarCambio(cotizacionesGlobo.DAX?.cambio ?? null),
      3: normalizarCambio(cotizacionesGlobo.FTSE?.cambio ?? null),
      4: normalizarCambio(cotizacionesGlobo.NIKKEI?.cambio ?? null),
      5: normalizarCambio(sse),
      6: normalizarCambio(xjo),
    }
  } catch {
    // riesgo se queda null y sentimientoPorRegion vacio — el chip y el tiñe del globo
    // simplemente no se muestran, no tumban el resto de la home.
  }

  // Un solo pedido a getPivotQuotes('D') alimenta la vista previa chica del hero (BTC, classic
  // solamente) Y la escalera interactiva de la seccion "Pivot Points Diarios" de mas abajo (los
  // 3 activos, los 5 metodos — se calculan todos de una vez, cambiar de metodo/activo ahi es
  // solo re-renderizar con datos que ya estan en el cliente, sin pedir de nuevo).
  let pivotePreview: PivotePreview | null = null
  let pivotesHome: ActivoPivote[] = []
  try {
    const quotes = await getPivotQuotes('D')
    const porTv: Record<string, string> = { 'BINANCE:BTCUSDT': 'BTC/USD', 'FX:EURUSD': 'EUR/USD', 'OANDA:XAUUSD': 'XAU/USD' }
    pivotesHome = Object.entries(porTv)
      .map(([tv, label]) => {
        const q = quotes.find((x) => x.symbol === tv)
        if (!q) return null
        const result = calculatePivots(q.previous.high, q.previous.low, q.previous.close, q.previous.open)
        return { tv, label, result, price: q.price }
      })
      .filter((a): a is ActivoPivote => a != null)

    const btc = pivotesHome.find((a) => a.tv === 'BINANCE:BTCUSDT')
    if (btc) {
      const { classic } = btc.result
      pivotePreview = { s3: classic.s3, s2: classic.s2, s1: classic.s1, pivot: classic.pivot, r1: classic.r1, r2: classic.r2, r3: classic.r3, precioActual: btc.price }
    }
  } catch {
    // pivotePreview se queda null y pivotesHome vacio — PivotShowcase muestra su propio ejemplo
    // estatico en vez de una caja vacia (plan 009 §13.1).
  }

  const breaking = featured
  const grid = latest

  return (
    <>

      <HomeHero
        locale={locale}
        postCount={postCount}
        assetCount={assetCount}
        btcPrice={btcPrice}
        noticiasPreview={noticiasPreview}
        cotizacionesPreview={cotizacionesPreview}
        pivotePreview={pivotePreview}
        cotizacionesGlobo={cotizacionesGlobo}
        riesgo={riesgo}
        sentimientoPorRegion={sentimientoPorRegion}
      />

      <main id="main-content" tabIndex={-1} className="flex-grow pb-24 pt-10 max-w-[1200px] mx-auto px-6 md:px-8 w-full">
        {/* Only surfaces when something is actually wrong — same alert pattern as /markets */}
        {sourceDown && (
          <p role="alert" className="mb-6 rounded-[8px] border border-semantic-warning/40 bg-semantic-warning/10 px-4 py-3 text-body-sm text-ink">
            {dict.home.sourceDownAlert}
          </p>
        )}

        {/* Breaking alert */}
        {breaking && <div className="mb-8"><BreakingPost post={breaking} /></div>}

        {/* News grid */}
        <section className="mt-10" aria-label={dict.home.newsGridAria}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <h2 className="text-headline text-ink">{dict.home.latestNewsTitle}</h2>
            <p className="text-body-sm text-ink-muted">
              {t(dict.home.newsCount, { n: grid.length, unit: grid.length === 1 ? dict.home.newsUnitSingular : dict.home.newsUnitPlural })}
            </p>
          </div>
          {grid.length > 0 ? (
            <NewsGrid posts={grid} />
          ) : (
            <div className="rounded-2xl border border-dashed border-hairline px-6 py-16 text-center">
              <p className="text-body text-ink-muted">{dict.home.emptyGridMessage}</p>
              <Link
                href="/articulos"
                className="mt-3 inline-block text-body-sm font-medium text-accent-blue hover:text-accent-blue-hover"
              >
                {dict.home.viewAllNews}
              </Link>
            </div>
          )}
        </section>

        {/* Posts by category */}
        {!sourceDown && (
          <section className="mt-16" aria-label={dict.home.exploreByCategoryAria}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px] text-accent-blue" aria-hidden="true">
                folder_open
              </span>
              <h2 className="text-headline text-ink">{dict.home.exploreByCategoryTitle}</h2>
            </div>
            {CATEGORY_SLUGS.map((slug) => (
              <LatestByCategory key={slug} categorySlug={slug} posts={categoryPosts[slug] ?? []} locale={locale} />
            ))}
          </section>
        )}

        {/* Pivot Points Diarios: escalera interactiva real (plan 009 §13.1), no una caja con un
            icono decorativo y un boton — metodo y activo se eligen ahi mismo, sin salir de la
            home. Si getPivotQuotes() fallo, PivotShowcase se encarga de mostrar su propio
            ejemplo etiquetado en vez de una seccion vacia. */}
        <PivotShowcase activos={pivotesHome} locale={locale} />

        {/* VIP Terminal Ultra Algo: rediseño completo (plan 009 §13.2) — 3 beneficios reales en
            vez de un parrafo, consola de alertas de ejemplo (tipeando, etiquetada) en vez de la
            tabla "el portal en cifras" (ese "cada 30s" no era verdad: el ticker real consulta
            cada 3s, lib/ticker.ts — B8). */}
        <VipShowcase locale={locale} vipUrl={VIP_URL} telegramUrl={TELEGRAM_URL} />
      </main>

    </>
  )
}
