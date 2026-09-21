import { Metadata } from 'next'
import Link from 'next/link'
import { CategoryFilter, ArticleCard, Pagination } from '@/components/ui'
import { getPublishedPosts, getCategories, getTags, getAssets } from '@/lib/api'

interface ArticlesPageProps {
  searchParams: Promise<{ categoria?: string; tag?: string; activo?: string; q?: string; page?: string }>
}

export const metadata: Metadata = {
  title: 'Todas las Noticias',
  description: 'Explora todas las noticias financieras, análisis de mercados y reportes de trading.',
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const limit = 12
  const offset = (page - 1) * limit

  const [fetched, categories, tags, assets] = await Promise.all([
    getPublishedPosts({
      limit: limit + 1,
      offset,
      categorySlug: params.categoria,
      tagSlug: params.tag,
      assetSymbol: params.activo,
      search: params.q,
    }),
    getCategories(),
    getTags(),
    getAssets(),
  ])

  const hasMore = fetched.length > limit
  const posts = fetched.slice(0, limit)
  const hasFilters = params.categoria || params.tag || params.activo || params.q

  return (
    <>

      <main id="main-content" tabIndex={-1} className="flex-1 pt-[104px] pb-24">
        <div className="section-container mb-8 pt-8">
          <h1 className="text-display-lg-mobile sm:text-display-lg font-bold text-ink mb-2">Noticias del Mercado</h1>
          <p className="text-body text-on-surface-variant">
            {hasFilters ? 'Resultados filtrados' : 'Todas las noticias publicadas, ordenadas por fecha.'}
          </p>
        </div>

        <section className="mb-8" aria-label="Filtros">
          <CategoryFilter categories={categories} tags={tags} assets={assets} />
        </section>

        <section aria-label="Artículos">
          <div className="section-container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>

            {posts.length === 0 && (
              <div className="text-center py-16 text-on-surface-variant">
                <svg className="w-16 h-16 mx-auto mb-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <p className="text-body-lg">No se encontraron artículos con los filtros actuales.</p>
                <Link
                  href="/articulos"
                  className="mt-4 inline-block text-accent-blue hover:text-accent-blue-hover text-body-sm font-medium"
                >
                  Ver todas las noticias
                </Link>
              </div>
            )}

            <Pagination basePath="/articulos" params={params} page={page} hasMore={hasMore} />
          </div>
        </section>
      </main>

    </>
  )
}