import Link from 'next/link'
import { categoryMeta, excerpt, localizedPostContent, sentimentMeta, timeAgo } from '@/lib/feed'
import { getDictionary, t, type Locale } from '@/lib/i18n/get-dictionary'
import { SITE_NAME } from '@/lib/site'
import type { PostWithRelations } from '@/lib/types'
import { MediaPreview } from './MediaPreview'

type ArticleCardVariant = 'cover' | 'compact'

// Toda la tarjeta es el área de clic (el título estira su enlace sobre ella con ::after) y el
// foco del título se dibuja sobre la tarjeta entera. El hover solo cambia borde, fondo y color
// del título, sin levantar la tarjeta: en una rejilla de 15 tarjetas el salto y la sombra pesada
// competían entre sí. h-full alinea los pies de una misma fila aunque el brief no tenga resumen.
const CARD_CLASS =
  'group relative flex h-full flex-col rounded-lg border border-hairline-soft bg-surface-1 transition-[border-color,background-color] duration-200 ease-out has-[h3_a:focus-visible]:outline-2 has-[h3_a:focus-visible]:outline-offset-2 has-[h3_a:focus-visible]:outline-accent-blue [@media(hover:hover)]:hover:border-hairline [@media(hover:hover)]:hover:bg-surface-2/60'
const TITLE_CLASS =
  "font-serif font-semibold text-ink transition-colors duration-150 line-clamp-3 after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none [@media(hover:hover)]:group-hover:text-accent-blue"
const ARROW_CLASS =
  'material-symbols-outlined text-[18px] text-ink-subtle transition-[transform,color] duration-150 ease-out [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:text-accent-blue'

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
    <div className="flex min-w-0 items-center gap-2 text-micro text-ink-muted">
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
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 tabular-nums" title={dict.articleCard.viewsTitle}>
        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
          visibility
        </span>
        <span className="sr-only">{dict.articleCard.viewsTitle}:</span>
        {post.view_count.toLocaleString(locale === 'en' ? 'en-US' : 'es-ES')}
      </span>
    </div>
  )
}

function ReadingInfo({ post, isBrief, locale }: { post: PostWithRelations; isBrief: boolean; locale: Locale }) {
  const dict = getDictionary(locale)
  if (isBrief) {
    return <span className="rounded-full border border-hairline px-2 py-0.5 text-micro font-medium text-ink-muted">{dict.articleCard.briefLabel}</span>
  }
  if (!post.reading_time_minutes) return null
  return (
    <span className="inline-flex items-center gap-1 text-micro text-ink-muted">
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
        menu_book
      </span>
      {t(dict.articleCard.readingTime, { n: post.reading_time_minutes })}
    </span>
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
  const sent = sentimentMeta(post.sentiment, locale)
  // localizedPostContent (no localizedPost): el titulo YA resolvia el idioma activo, pero el
  // resumen de abajo seguia leyendo post.content_html a pelo — el campo BASE, que con el Modelo A
  // esta siempre en original_locale, nunca en la traduccion. Mismo patron que el bug del nombre
  // de autor (F0): coincidia por casualidad mientras no habia traducciones de verdad, y dejo de
  // coincidir en cuanto el pipeline empezo a producir filas 'en' genuinas.
  const { title, slug, contentHtml } = localizedPostContent(post, locale)
  // Brief y artículo enlazan igual a su página: el brief solo omite el párrafo de resumen
  const href = `/articulos/${slug}`
  const symbol = post.assets?.[0]?.symbol
  const isBrief = post.format === 'brief'

  if (variant === 'compact') {
    return (
      <article className={`${CARD_CLASS} p-4`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <PostMeta post={post} locale={locale} />
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-micro font-semibold uppercase tracking-wider ${sent.chip}`}
          >
            {sent.label}
          </span>
        </div>

        <h3 className="mb-2 text-body-lg leading-[1.3]">
          <Link href={href} className={TITLE_CLASS}>
            {title}
          </Link>
        </h3>

        {!isBrief && <p className="mb-3 text-body-sm leading-relaxed text-ink-muted line-clamp-2">{excerpt(contentHtml)}</p>}

        <div className="mt-auto flex items-center gap-2 border-t border-hairline-soft pt-3">
          {symbol && (
            <span className="inline-flex items-center rounded-full border border-accent-blue/30 bg-accent-blue/10 px-2 py-0.5 text-micro font-semibold text-accent-blue">
              {symbol}
            </span>
          )}
          <ReadingInfo post={post} isBrief={isBrief} locale={locale} />
          <span className={`${ARROW_CLASS} ml-auto`} aria-hidden="true">
            east
          </span>
        </div>
      </article>
    )
  }

  const meta = categoryMeta(post.category, locale)
  // Respaldo a la MARCA, no a una persona: desde la separacion de identidades el autor por
  // defecto del portal es Grizzly Traders, y un literal con el nombre del fundador firmaba con
  // su nombre articulos que no son suyos cuando el join de autor no venia en la consulta.
  const authorName = post.author?.full_name ?? SITE_NAME
  const initials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <article className={`${CARD_CLASS} p-3`}>
      <div className="relative mb-3 aspect-[16/10] overflow-hidden rounded-md border border-hairline-soft bg-surface-2">
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

      <div className="flex flex-1 flex-col gap-2 px-1">
        <PostMeta post={post} showSentiment locale={locale} />

        <h3 className="text-body-lg leading-[1.25]">
          <Link href={href} className={TITLE_CLASS}>
            {title}
          </Link>
        </h3>

        {!isBrief && <p className="text-body-sm leading-relaxed text-ink-muted line-clamp-2">{excerpt(contentHtml)}</p>}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline-soft px-1 pt-3">
        <Link
          href={`/autor/${post.author?.slug ?? 'grizzly-traders'}`}
          className="relative z-10 flex min-w-0 items-center gap-1.5 rounded-sm text-ink-muted transition-colors hover:text-accent-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-blue/10 text-micro font-bold text-accent-blue" aria-hidden="true">
            {initials}
          </span>
          <span className="truncate text-micro">{authorName}</span>
        </Link>
        <span className="flex shrink-0 items-center gap-3">
          <ReadingInfo post={post} isBrief={isBrief} locale={locale} />
          <span className={ARROW_CLASS} aria-hidden="true">
            east
          </span>
        </span>
      </div>
    </article>
  )
}
