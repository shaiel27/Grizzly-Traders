import Link from 'next/link'
import { categoryMeta, excerpt, localizedPost, sentimentMeta, timeAgo } from '@/lib/feed'
import type { PostWithRelations } from '@/lib/types'
import { MediaPreview } from './MediaPreview'

type ArticleCardVariant = 'cover' | 'compact'

const CARD_CLASS =
  'group flex flex-col rounded-lg border border-hairline-soft bg-surface-1 transition-colors duration-200 hover:border-hairline hover:bg-surface-2/50'
const TITLE_CLASS =
  'font-serif text-[18px] font-semibold leading-[1.25] text-ink transition-colors line-clamp-3 hover:text-accent-blue'
const ARROW_CLASS =
  'material-symbols-outlined text-[18px] text-ink-subtle transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue'

function PostMeta({ post, showReadingTime }: { post: PostWithRelations; showReadingTime: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-muted">
      <span className="inline-flex items-center gap-1">
        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
          schedule
        </span>
        {timeAgo(post.published_at)}
      </span>
      {post.source && (
        <>
          <span aria-hidden="true">·</span>
          <span>{post.source.name}</span>
        </>
      )}
      {showReadingTime && post.reading_time_minutes ? (
        <span className="ml-auto inline-flex items-center gap-1 text-ink-muted">
          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
            menu_book
          </span>
          {post.reading_time_minutes} min
        </span>
      ) : null}
    </div>
  )
}

export function ArticleCard({ post, variant = 'cover' }: { post: PostWithRelations; variant?: ArticleCardVariant }) {
  const sent = sentimentMeta(post.sentiment)
  const { title, slug } = localizedPost(post)
  const href = `/articulos/${slug}`
  const symbol = post.assets?.[0]?.symbol

  if (variant === 'compact') {
    return (
      <article className={`${CARD_CLASS} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <PostMeta post={post} showReadingTime={false} />
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sent.chip}`}
          >
            {sent.label}
          </span>
        </div>

        <Link href={href} className={`${TITLE_CLASS} mb-2`}>
          {title}
        </Link>

        <p className="mb-3 text-[14px] leading-relaxed text-ink-muted line-clamp-2">{excerpt(post.content_html)}</p>

        <div className="mt-auto flex items-center justify-between border-t border-hairline-soft pt-3">
          {symbol && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-2 py-0.5 text-[10px] font-semibold text-accent-blue">
              {symbol}
            </span>
          )}
          <Link href={href} aria-label={`Leer: ${title}`} className={`${ARROW_CLASS} ml-auto`}>
            east
          </Link>
        </div>
      </article>
    )
  }

  const meta = categoryMeta(post.category)
  const authorName = post.author?.full_name ?? 'Grizzly Traders'
  const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <article className={`${CARD_CLASS} p-3`}>
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-md border border-hairline-soft">
        <MediaPreview src={post.cover_image_url} icon={meta.icon} mediaGradient={meta.media} symbol={symbol} />
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border bg-surface-container-lowest/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${meta.chip}`}
        >
          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
            {meta.icon}
          </span>
          {meta.name}
        </span>
        <span
          className={`absolute right-2 top-2 inline-flex items-center rounded-full border bg-surface-container-lowest/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ${sent.chip}`}
        >
          {sent.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <PostMeta post={post} showReadingTime />

        <Link href={href} className={TITLE_CLASS}>
          {title}
        </Link>

        <p className="text-[14px] leading-relaxed text-ink-muted line-clamp-2">{excerpt(post.content_html)}</p>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-hairline-soft pt-3">
        <Link
          href={`/autor/${post.author?.slug ?? 'grizzly-traders'}`}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-accent-blue/10 text-[10px] font-bold text-accent-blue">
            {initials}
          </span>
          <span className="text-[11px] text-ink-muted transition-colors hover:text-accent-blue">{authorName}</span>
        </Link>
        <Link href={href} aria-label={`Leer: ${title}`} className={ARROW_CLASS}>
          east
        </Link>
      </div>
    </article>
  )
}
