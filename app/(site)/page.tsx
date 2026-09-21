import type { Metadata } from 'next'
import Link from 'next/link'
import { ArticleCard, BreakingPost, FeedControls } from '@/components/ui'
import { LatestByCategory, SentimentSummary, StatsBar } from '@/components/modules'
import {
  getPublishedPosts,
  getFeaturedPosts,
  getPostsByCategory,
  getPostCount,
  getCategories,
  getAssets,
  getSources,
  getSentimentSummary,
} from '@/lib/api'
import type { PostWithRelations } from '@/lib/types'

export const metadata: Metadata = {
  description:
    'Noticias financieras y análisis de mercados: criptomonedas, forex, materias primas y acciones, con niveles técnicos y cotizaciones.',
}

const CATEGORIES = [
  { slug: 'criptomonedas', name: 'Criptomonedas' },
  { slug: 'forex', name: 'Forex' },
  { slug: 'materias-primas', name: 'Materias Primas' },
  { slug: 'acciones', name: 'Acciones' },
]

const SENTIMENT_DAYS = 30
const VIP_URL = process.env.NEXT_PUBLIC_VIP_URL
const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const params = await searchParams
  const category = params.categoria ?? ''

  let featured: PostWithRelations | undefined
  let latest: PostWithRelations[] = []
  const categoryPosts: Record<string, PostWithRelations[]> = {}
  let postCount = 0
  let categoryCount = 0
  let assetCount = 0
  let sourceCount = 0
  let sentiment = { bullish: 0, bearish: 0, neutral: 0, total: 0 }
  let sourceDown = false

  try {
    const [featuredPosts, latestPosts, postsByCategory, count, categories, assets, sources, sentimentSummary] = await Promise.all([
      getFeaturedPosts(1),
      getPublishedPosts({ limit: 6, categorySlug: category || undefined }),
      Promise.all(CATEGORIES.map((cat) => getPostsByCategory(cat.slug, 3))),
      getPostCount(),
      getCategories(),
      getAssets(),
      getSources(),
      getSentimentSummary(SENTIMENT_DAYS),
    ])

    featured = featuredPosts[0]
    latest = latestPosts
    postCount = count
    categoryCount = categories.length
    assetCount = assets.length
    sourceCount = sources.length
    sentiment = sentimentSummary

    CATEGORIES.forEach((cat, i) => {
      categoryPosts[cat.slug] = postsByCategory[i]
    })
  } catch {
    sourceDown = true
  }

  const breaking = featured
  const grid = latest
  const specs = [
    { icon: 'article', label: 'Artículos publicados', value: postCount.toLocaleString('es-ES') },
    { icon: 'candlestick_chart', label: 'Activos rastreados', value: assetCount.toString() },
    { icon: 'hub', label: 'Fuentes monitoreadas', value: sourceCount.toString() },
    { icon: 'update', label: 'Actualización de precios', value: 'cada 30 s' },
  ]

  return (
    <>

      <main id="main-content" tabIndex={-1} className="flex-grow pt-[104px] pb-24 max-w-[1200px] mx-auto px-6 md:px-8 w-full">
        {/* Hero header */}
        <section className="relative mt-6 mb-6 flex flex-col gap-5" aria-label="Titular de la terminal">
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-tight text-ink-muted">
            {sourceDown ? (
              <span className="text-semantic-warning">[&nbsp;ERR&nbsp;] Datos no disponibles temporalmente</span>
            ) : (
              <>
                <span className="text-semantic-success">[&nbsp;OK&nbsp;]</span>
                <span>{postCount.toLocaleString('es-ES')} artículos publicados</span>
                <span className="size-1 rounded-full bg-hairline" aria-hidden="true" />
                <span>{assetCount} activos rastreados</span>
                <span className="size-1 rounded-full bg-hairline" aria-hidden="true" />
                <span>{sourceCount} fuentes monitoreadas</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-display-lg-mobile sm:text-display-lg md:text-display-xl font-bold tracking-tight text-ink">
              Inteligencia de Mercado en Vivo
            </h1>
          </div>

          <p className="max-w-2xl text-body text-on-surface-variant">
            Noticias y análisis de los mercados financieros, con cotizaciones y niveles de soporte y resistencia para
            operar con más contexto.
          </p>
        </section>

        {/* Stats bar */}
        <StatsBar postCount={postCount} categoryCount={categoryCount} assetCount={assetCount} sourceCount={sourceCount} />

        <SentimentSummary {...sentiment} days={SENTIMENT_DAYS} />

        {/* Breaking alert */}
        {breaking && <BreakingPost post={breaking} />}

        {/* Feed controls */}
        <section className="mt-6 mb-4" aria-label="Controles del feed">
          <FeedControls category={category} />
        </section>

        {/* News grid */}
        <section className="mb-10" aria-label="Conjunto de noticias">
          <h2 className="text-headline font-bold text-ink mb-4">Últimas Noticias</h2>
          {grid.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {grid.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-hairline px-6 py-16 text-center">
              <p className="text-body text-ink-muted">No hay publicaciones en este flujo todavía.</p>
              <Link
                href="/articulos"
                className="mt-3 inline-block text-body-sm font-medium text-accent-blue hover:text-accent-blue-hover"
              >
                Ver todas las noticias
              </Link>
            </div>
          )}
        </section>

        {/* Posts by category */}
        {!sourceDown && (
          <section aria-label="Noticias por categoría">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[20px] text-accent-blue" aria-hidden="true">
                folder_open
              </span>
              <h2 className="text-headline font-bold text-ink">Explorar por Categoría</h2>
            </div>
            {CATEGORIES.map((cat) => (
              <LatestByCategory
                key={cat.slug}
                categorySlug={cat.slug}
                categoryName={cat.name}
                posts={categoryPosts[cat.slug] ?? []}
              />
            ))}
          </section>
        )}

        {/* Pivot Points CTA */}
        <section className="mt-10 mb-2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-8" aria-label="Pivot Points">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-symbols-outlined text-[24px] text-accent-blue" aria-hidden="true">
                  functions
                </span>
                <h2 className="text-headline font-bold text-ink">Pivot Points Diarios</h2>
              </div>
              <p className="text-body text-on-surface-variant max-w-xl">
                Niveles de soporte y resistencia calculados con 5 métodos (Clásico, Fibonacci, Camarilla, Woodie, DeMark). Datos en tiempo real de TradingView.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <Link
                  href="/pivot-points"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-blue-hover"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">candlestick_chart</span>
                  Ver Pivot Points
                </Link>
              </div>
            </div>
            <div className="hidden lg:block w-48 h-32 rounded-xl border border-outline-variant/40 bg-surface-2/50 flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-[32px] text-accent-blue/60" aria-hidden="true">stacked_line_chart</span>
                <p className="text-micro text-ink-muted mt-1">5 Métodos</p>
                <p className="text-micro text-ink-muted">S1-S3 · R1-R3</p>
              </div>
            </div>
          </div>
        </section>

        {/* VIP banner */}
        <section id="vip" className="relative mt-10 mb-2 overflow-hidden rounded-2xl border border-hairline bg-surface-container-lowest p-6 md:p-8" aria-label="Unirse al VIP Terminal">
          <div
            className="absolute inset-0 opacity-70 pointer-events-none"
            style={{
              background:
                'radial-gradient(50% 120% at 0% 50%, rgba(255,122,61,0.14), transparent 60%), radial-gradient(50% 120% at 100% 50%, rgba(106,76,245,0.16), transparent 60%)',
            }}
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gradient-orange/40 bg-gradient-orange/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gradient-orange">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  workspace_premium
                </span>
                VIP Terminal Ultra Algo
              </span>
              <h2 className="mt-3 text-headline font-bold tracking-tight text-ink">
                Desbloquea el poder de la inteligencia artificial
              </h2>
              <p className="mt-2 max-w-xl text-body text-ink-subtle">
                Recibe análisis y alertas de Grizzly Traders para tomar decisiones más informadas.
              </p>
              {(VIP_URL || TELEGRAM_URL) && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {VIP_URL && (
                    <a
                      href={VIP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-accent-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-blue-hover"
                    >
                      Join VIP Terminal
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
                      Unirse por Telegram
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="w-full lg:w-[340px] shrink-0 overflow-hidden rounded-xl border border-hairline bg-surface-1/70">
              <div className="flex items-center justify-between border-b border-hairline-soft bg-white/[0.02] px-4 py-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                  el portal en cifras
                </span>
              </div>
              <div className="divide-y divide-hairline-soft">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex items-center justify-between gap-6 px-4 py-3">
                    <span className="flex items-center gap-2 text-[13px] text-ink-muted">
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
