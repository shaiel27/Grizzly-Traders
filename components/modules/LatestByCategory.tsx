import Link from 'next/link'
import { categoryMeta } from '@/lib/feed'
import type { PostWithRelations } from '@/lib/types'
import { ArticleCard } from '@/components/ui/ArticleCard'

interface LatestByCategoryProps {
  categorySlug: string
  categoryName: string
  posts: PostWithRelations[]
}

export function LatestByCategory({ categorySlug, categoryName, posts }: LatestByCategoryProps) {
  if (posts.length === 0) return null

  const meta = categoryMeta({ id: 0, name: categoryName, slug: categorySlug, created_at: '', updated_at: '' })

  return (
    <section className="mb-10" aria-label={`Últimas de ${categoryName}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`flex size-8 items-center justify-center rounded-lg border ${meta.chip}`}>
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              {meta.icon}
            </span>
          </span>
          <h2 className="text-headline font-bold text-ink">{categoryName}</h2>
        </div>
        <Link
          href={`/articulos?categoria=${categorySlug}`}
          className="inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          Ver todas
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {posts.map((post) => (
          <ArticleCard key={post.id} post={post} variant="compact" />
        ))}
      </div>
    </section>
  )
}
