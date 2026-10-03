import { Metadata } from 'next'
import { ArticleCard, CategoryFilter, Pagination } from '@/components/ui'
import { searchPosts, getCategories, getTags, getAssets } from '@/lib/api'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary, t } from '@/lib/i18n/get-dictionary'

interface SearchPageProps {
  searchParams: Promise<{ q?: string; categoria?: string; tag?: string; activo?: string; page?: string }>
}

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false, follow: true },
  description: 'Busca noticias financieras, análisis de mercados, activos y autores.',
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''
  const page = Math.min(Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1), 50)
  const limit = 12
  const offset = (page - 1) * limit
  const locale = await getServerLocale()
  const dict = getDictionary(locale)

  const [fetched, categories, tags, assets] = await Promise.all([
    query ? searchPosts(query, locale, offset + limit + 1).then((p) => p.slice(offset)) : Promise.resolve([]),
    getCategories(),
    getTags(),
    getAssets(),
  ])

  const hasMore = fetched.length > limit
  const posts = fetched.slice(0, limit)

  return (
    <>

      <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
        <div className="section-container mb-8 pt-8">
          <h1 className="font-serif text-display-lg-mobile sm:text-display-lg font-bold text-ink mb-2">
            {query ? t(dict.listings.searchResultsTitle, { q: query }) : dict.listings.searchTitle}
          </h1>
          <p className="text-body text-on-surface-variant">
            {query
              ? posts.length > 0
                ? t(dict.listings.searchShowingResults, { n: posts.length })
                : dict.listings.searchNoResults
              : dict.listings.searchPrompt}
          </p>
        </div>

        <form action="/buscar" method="get" role="search" className="section-container mb-6">
          <div className="flex max-w-2xl items-center gap-2 rounded-full border border-outline-variant/70 bg-canvas/70 py-1.5 pl-4 pr-1.5 focus-within:border-accent-blue">
            <span className="material-symbols-outlined text-[18px] text-ink-muted" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              aria-label={dict.listings.searchInputAria}
              placeholder={dict.listings.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
            />
            <button type="submit" className="btn-primary !py-2">
              {dict.listings.searchButton}
            </button>
          </div>
        </form>

        <section className="mb-8" aria-label={dict.listings.filtersAria}>
          <CategoryFilter categories={categories} tags={tags} assets={assets} />
        </section>

        <section aria-label={dict.listings.searchResultsAria}>
          <div className="section-container">
            {query && posts.length === 0 && (
              <div className="text-center py-16 text-on-surface-variant">
                <svg className="w-16 h-16 mx-auto mb-4 text-ink-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <p className="text-body-lg">{t(dict.listings.searchNoResultsFor, { q: query })}</p>
                <p className="text-body text-ink-muted mt-2">{dict.listings.searchTryAgain}</p>
              </div>
            )}

            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <ArticleCard post={post} locale={locale} />
                </li>
              ))}
            </ul>

            {query && <Pagination basePath="/buscar" params={params} page={page} hasMore={hasMore} locale={locale} />}
          </div>
        </section>
      </main>

    </>
  )
}