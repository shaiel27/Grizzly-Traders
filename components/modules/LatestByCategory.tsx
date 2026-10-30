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
    <section className="mb-10 border-t border-hairline-soft pt-6 first-of-type:border-t-0 first-of-type:pt-0" aria-label={t(dict.latestByCategory.sectionAria, { name: meta.name })}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className={`flex size-7 items-center justify-center rounded-md border ${meta.chip}`}>
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              {meta.icon}
            </span>
          </span>
          <h3 className="font-serif text-[19px] font-bold tracking-tight text-ink">{meta.name}</h3>
        </div>
        <Link
          href={`/articulos?categoria=${categorySlug}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-body-sm font-medium text-accent-blue transition-colors hover:text-accent-blue-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
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
