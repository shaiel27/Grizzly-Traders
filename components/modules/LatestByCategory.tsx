import Link from 'next/link'
import { categoryMeta } from '@/lib/feed'
import { getDictionary, t, type Locale } from '@/lib/i18n/get-dictionary'
import type { PostWithRelations } from '@/lib/types'
import { ArticleCard } from '@/components/ui/ArticleCard'

interface LatestByCategoryProps {
  categorySlug: string
  posts: PostWithRelations[]
  locale?: Locale
}

export function LatestByCategory({ categorySlug, posts, locale = 'es' }: LatestByCategoryProps) {
  if (posts.length === 0) return null

  const dict = getDictionary(locale)
  const meta = categoryMeta({ id: 0, name: '', slug: categorySlug, created_at: '', updated_at: '' }, locale)

  return (
    <section className="mb-10" aria-label={t(dict.latestByCategory.sectionAria, { name: meta.name })}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-8 items-center justify-center rounded-lg border ${meta.chip}`}>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {meta.icon}
            </span>
          </span>
          <h2 className="text-headline text-ink">{meta.name}</h2>
        </div>
        <Link
          href={`/articulos?categoria=${categorySlug}`}
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          {dict.latestByCategory.viewAll}
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {posts.map((post) => (
          <li key={post.id}>
            <ArticleCard post={post} variant="compact" locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  )
}
