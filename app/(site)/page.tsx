import type { Metadata } from 'next'
import Link from 'next/link'
import { BreakingPost, NewsGrid, NewsletterForm } from '@/components/ui'
import { HomeHero, LatestByCategory } from '@/components/modules'
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
import type { PostWithRelations } from '@/lib/types'
import type { NoticiaPreview, CotizacionPreview, PivotePreview } from '@/components/modules/HomeFeatures'

export const metadata: Metadata = {
  description:
    'Noticias financieras y análisis de mercados: criptomonedas, forex, materias primas y acciones, con niveles técnicos y cotizaciones.',
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

  const cotizacionesPreview: CotizacionPreview[] = await getTickerSnapshot()
    .then((snap) => {
      const simbolos = ['BTC', 'XAUUSD', 'SPX']
      return simbolos
        .map((s) => snap.quotes.find((q) => q.symbol === s))
        .filter((q): q is NonNullable<typeof q> => q != null)
        .map((q) => ({ simbolo: q.symbol, label: q.label, precio: q.price, cambio: q.changePercent, moneda: q.currency }))
    })
    .catch(() => [])

  const pivotePreview: PivotePreview | null = await getPivotQuotes('D')
    .then((quotes) => {
      const btc = quotes.find((q) => q.symbol === 'BINANCE:BTCUSDT')
      if (!btc) return null
      const niveles = calculatePivots(btc.previous.high, btc.previous.low, btc.previous.close, btc.previous.open).classic
      return { s3: niveles.s3, s2: niveles.s2, s1: niveles.s1, pivot: niveles.pivot, r1: niveles.r1, r2: niveles.r2, r3: niveles.r3, precioActual: btc.price }
    })
    .catch(() => null)

  const breaking = featured
  const grid = latest
  const specs = [{ icon: 'update', label: dict.home.vipSpecLabel, value: dict.home.vipSpecValue }]

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

        {/* Pivot Points CTA */}
        <section className="mt-16 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-8" aria-label={dict.home.pivotSectionAria}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-[24px] text-accent-blue" aria-hidden="true">
                  functions
                </span>
                <h2 className="text-headline text-ink">{dict.home.pivotTitle}</h2>
              </div>
              <p className="text-body text-on-surface-variant max-w-xl">
                {dict.home.pivotDesc}
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Link
                  href="/pivot-points"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-accent-blue-hover"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">candlestick_chart</span>
                  {dict.home.pivotCta}
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex w-48 h-32 rounded-xl border border-outline-variant/40 bg-surface-2/50 items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-[32px] text-accent-blue/60" aria-hidden="true">stacked_line_chart</span>
                <p className="text-micro text-ink-muted mt-1">{dict.home.pivotMethodsLabel}</p>
                <p className="text-micro text-ink-muted">{dict.home.pivotLevelsLabel}</p>
              </div>
            </div>
          </div>
        </section>

        {/* VIP banner */}
        <section id="vip" className="relative mt-16 overflow-hidden rounded-2xl border border-hairline bg-surface-container-lowest p-6 md:p-8" aria-label={dict.home.vipSectionAria}>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1 text-micro font-semibold uppercase tracking-wide text-brand-amber">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  workspace_premium
                </span>
                {dict.home.vipBadge}
              </span>
              <h2 className="mt-3 text-headline tracking-tight text-ink">
                {dict.home.vipTitle}
              </h2>
              <p className="mt-2 max-w-xl text-body text-ink-subtle">
                {dict.home.vipLead}
              </p>
              {(VIP_URL || TELEGRAM_URL) && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {VIP_URL && (
                    <a
                      href={VIP_URL}
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
                  {TELEGRAM_URL && (
                    <a
                      href={TELEGRAM_URL}
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
              {!VIP_URL && !TELEGRAM_URL && (
                <div className="mt-6">
                  <NewsletterForm />
                </div>
              )}
            </div>

            <div className="w-full lg:w-[340px] shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface-1/70">
              <div className="flex items-center justify-between border-b border-hairline-soft bg-white/[0.02] px-4 py-2.5">
                <span className="font-mono text-micro font-semibold uppercase tracking-[0.18em] text-ink-muted">
                  {dict.home.vipStatsHeader}
                </span>
              </div>
              <div className="divide-y divide-hairline-soft">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex items-center justify-between gap-6 px-4 py-3">
                    <span className="flex items-center gap-2 text-caption text-ink-muted">
                      <span className="material-symbols-outlined text-[15px] text-ink-subtle" aria-hidden="true">
                        {spec.icon}
                      </span>
                      {spec.label}
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-ink">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

    </>
  )
}
