'use client'

import { clsx } from 'clsx'
import { useMemo, useState } from 'react'
import { ArticleCard } from './ArticleCard'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import { t } from '@/lib/i18n/get-dictionary'
import type { PostWithRelations } from '@/lib/types'

const INITIAL_COUNT = 6
const STEP = 6
type SortMode = 'recent' | 'views'

// Shows today's news capped to a handful of cards, with a "ver más" toggle to reveal the rest without
// leaving the home page. Both sort modes reuse the same already-fetched 24h list — re-sorting client-side
// avoids a second request just to answer "what's trending today".
export function NewsGrid({ posts }: { posts: PostWithRelations[] }) {
  // Se muestran de 6 en 6: antes "ver más" montaba de golpe hasta 60 tarjetas con su imagen
  const [count, setCount] = useState(INITIAL_COUNT)
  const [sort, setSort] = useState<SortMode>('recent')
  const { locale } = useLocale()
  const dict = useDictionary()

  const sorted = useMemo(() => {
    if (sort === 'recent') return posts
    return [...posts].sort((a, b) => b.view_count - a.view_count)
  }, [posts, sort])

  const remaining = sorted.length - count
  const visible = sorted.slice(0, count)

  return (
    <>
      <div className="mb-4 flex items-center gap-2" role="group" aria-label={dict.newsGrid.sortGroupAria}>
        <button
          type="button"
          onClick={() => setSort('recent')}
          aria-pressed={sort === 'recent'}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-caption font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue active:scale-[0.97] motion-reduce:transition-none',
            sort === 'recent'
              ? 'border-accent-blue bg-accent-blue text-canvas'
              : 'border-hairline bg-white/[0.04] text-ink-muted hover:text-ink'
          )}
        >
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            schedule
          </span>
          {dict.newsGrid.sortRecent}
        </button>
        <button
          type="button"
          onClick={() => setSort('views')}
          aria-pressed={sort === 'views'}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-caption font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue active:scale-[0.97] motion-reduce:transition-none',
            sort === 'views'
              ? 'border-accent-blue bg-accent-blue text-canvas'
              : 'border-hairline bg-white/[0.04] text-ink-muted hover:text-ink'
          )}
        >
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            trending_up
          </span>
          {dict.newsGrid.sortViews}
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((post) => (
          <li key={post.id}>
            <ArticleCard post={post} locale={locale} />
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setCount((current) => current + STEP)}
            className="inline-flex items-center gap-2 rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-out hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue active:scale-[0.97] motion-reduce:transition-none"
          >
            {t(dict.newsGrid.viewMore, { n: remaining })}
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              expand_more
            </span>
          </button>
        </div>
      )}
    </>
  )
}
