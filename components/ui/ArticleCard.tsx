import Link from 'next/link'
import { categoryMeta, excerpt, localizedPost, sentimentMeta, timeAgo } from '@/lib/feed'
import { getDictionary, t, type Locale } from '@/lib/i18n/get-dictionary'
import type { PostWithRelations } from '@/lib/types'
import { MediaPreview } from './MediaPreview'

type ArticleCardVariant = 'cover' | 'compact'

const CARD_CLASS =
  'group flex flex-col rounded-lg border border-hairline-soft bg-surface-1 transition-colors duration-200 hover:border-hairline hover:bg-surface-2/50'
const TITLE_CLASS =
  'font-serif text-body-lg font-semibold leading-[1.25] text-ink transition-colors line-clamp-3 hover:text-accent-blue'
const ARROW_CLASS =
  'material-symbols-outlined text-[18px] text-ink-subtle transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-accent-blue'

const SENTIMENT_TEXT: Record<string, string> = {
  bullish: 'text-semantic-success',
  bearish: 'text-semantic-danger',
  neutral: 'text-ink-muted',
}

function PostMeta({
  post,
  showSentiment = false,
  locale,
}: {
  post: PostWithRelations
  showSentiment?: boolean
  locale: Locale
}) {
  const dict = getDictionary(locale)
  const sent = showSentiment ? sentimentMeta(post.sentiment, locale) : null
  return (
    <div className="flex items-center gap-2 text-micro text-ink-muted">
      <span className="inline-flex shrink-0 items-center gap-1">
        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
          schedule
        </span>
        {/* "hace X min" is computed from Date.now(), which necessarily differs between the server
            render and the moment this hydrates in the browser — an intentional mismatch, not a bug. */}
        <span suppressHydrationWarning>{timeAgo(post.published_at, locale)}</span>
      </span>
      {post.source && (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate">{post.source.name}</span>
        </>
      )}
      {sent && (
        <>
          <span aria-hidden="true">·</span>
          <span className={SENTIMENT_TEXT[post.sentiment]}>{sent.label}</span>
        </>
      )}
      <span className="ml-auto inline-flex shrink-0 items-center gap-1" title={dict.articleCard.viewsTitle}>
        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
          visibility
        </span>
        {post.view_count.toLocaleString(locale === 'en' ? 'en-US' : 'es-ES')}
      </span>
    </div>
  )
}

export function ArticleCard({
  post,
  variant = 'cover',
  locale = 'es',
}: {
  post: PostWithRelations
  variant?: ArticleCardVariant
  locale?: Locale
}) {
  const dict = getDictionary(locale)
  const sent = sentimentMeta(post.sentiment, locale)
  const { title, slug } = localizedPost(post, locale)
  const href = `/articulos/${slug}`
  const symbol = post.assets?.[0]?.symbol
  const isBrief = post.format === 'brief'

  if (variant === 'compact') {
    return (
      <article className={`${CARD_CLASS} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <PostMeta post={post} locale={locale} />
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-micro font-semibold uppercase tracking-wider ${sent.chip}`}
          >
            {sent.label}
          </span>
        </div>

        {isBrief ? (
          <h3 className={`${TITLE_CLASS} mb-2`}>{title}</h3>
        ) : (
          <h3 className="mb-2">
            <Link href={href} className={TITLE_CLASS}>
              {title}
            </Link>
          </h3>
        )}

        {!isBrief && <p className="mb-3 text-body-sm leading-relaxed text-ink-muted line-clamp-2">{excerpt(post.content_html)}</p>}

        <div className="mt-auto flex items-center justify-between border-t border-hairline-soft pt-3">
          {symbol && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-blue/30 bg-accent-blue/10 px-2 py-0.5 text-micro font-semibold text-accent-blue">
              {symbol}
            </span>
          )}
          {!isBrief && (
            <Link href={href} aria-label={t(dict.articleCard.readMore, { title })} className={`${ARROW_CLASS} ml-auto`}>
              east
            </Link>
          )}
        </div>
      </article>
    )
  }

  const meta = categoryMeta(post.category, locale)
  const authorName = post.author?.full_name ?? 'Grizzly Traders'
  const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <article className={`${CARD_CLASS} p-3`}>
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-md border border-hairline-soft">
        <MediaPreview src={post.cover_image_url} icon={meta.icon} mediaGradient={meta.media} symbol={symbol} />
        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border bg-surface-container-lowest/90 px-2 py-0.5 text-micro font-semibold uppercase tracking-wider backdrop-blur-sm ${meta.chip}`}
        >
          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
            {meta.icon}
          </span>
          {meta.name}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <PostMeta post={post} showSentiment locale={locale} />

        {isBrief ? (
          <h3 className={TITLE_CLASS}>{title}</h3>
        ) : (
          <h3>
            <Link href={href} className={TITLE_CLASS}>{title}</Link>
          </h3>
        )}

        {!isBrief && <p className="text-body-sm leading-relaxed text-ink-muted line-clamp-2">{excerpt(post.content_html)}</p>}
      </div>

      {!isBrief && (
        <div className="mt-3 flex items-center justify-between border-t border-hairline-soft pt-3">
          <Link
            href={`/autor/${post.author?.slug ?? 'grizzly-traders'}`}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-accent-blue/10 text-micro font-bold text-accent-blue">
              {initials}
            </span>
            <span className="text-micro text-ink-muted transition-colors hover:text-accent-blue">{authorName}</span>
          </Link>
          <span className="flex items-center gap-3">
            {post.reading_time_minutes && (
              <span className="inline-flex items-center gap-1 text-micro text-ink-muted">
                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                  menu_book
                </span>
                {t(dict.articleCard.readingTime, { n: post.reading_time_minutes })}
              </span>
            )}
            <Link href={href} aria-label={t(dict.articleCard.readMore, { title })} className={ARROW_CLASS}>
              east
            </Link>
          </span>
        </div>
      )}
    </article>
  )
}
