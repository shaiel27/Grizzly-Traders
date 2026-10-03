'use client'

import Link from 'next/link'
import { categoryMeta, excerpt, sentimentMeta, timeAgo } from '@/lib/feed'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import type { PostWithRelations } from '@/lib/types'
import { MediaPreview } from './MediaPreview'
import { Button } from './Button'

export function BreakingPost({ post }: { post: PostWithRelations }) {
  const { locale } = useLocale()
  const dict = useDictionary()
  const meta = categoryMeta(post.category, locale)
  const sent = sentimentMeta(post.sentiment, locale)
  const symbol = post.assets?.[0]?.symbol
  const slug = post.slug
  const authorName = post.author?.full_name ?? 'Grizzly Traders'
  const authorInitial = authorName.charAt(0).toUpperCase()
  const assetSymbols = post.assets?.map((asset) => asset.symbol).join(', ')

  const details = [
    { icon: 'trending_up', label: dict.breakingPost.sentimentTile, value: sent.label },
    { icon: 'category', label: dict.breakingPost.categoryTile, value: meta.name },
    { icon: 'candlestick_chart', label: dict.breakingPost.assetsTile, value: assetSymbols || '—' },
  ]

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url: `${window.location.origin}/articulos/${slug}` })
      }
    } catch {
      /* noop */
    }
  }

  return (
    <section className="relative rounded-2xl p-1.5 border border-hairline overflow-hidden bg-surface-container-lowest">
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background: 'radial-gradient(60% 80% at 90% 90%, rgba(0,153,255,0.10), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative grid lg:grid-cols-[1.1fr_1fr] overflow-hidden rounded-xl">
        <div className="relative z-10 flex flex-col p-5 md:p-6 gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gradient-coral/40 bg-gradient-coral/10 px-2.5 py-1 text-micro font-bold uppercase tracking-widest text-gradient-coral">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-semantic-danger opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-semantic-danger" />
              </span>
              {dict.breakingPost.featuredBadge}
            </span>
            {/* Computed from Date.now(): server and client necessarily disagree, intentionally */}
            <span className="font-mono text-micro text-ink-muted" suppressHydrationWarning>
              {timeAgo(post.published_at, locale)}
            </span>
          </div>

          <div>
            <h2 className="font-serif text-[28px] font-bold leading-[1.15] tracking-[-0.015em] text-ink md:text-[32px]">
              {post.title}
            </h2>
<p className="mt-3 text-body-sm leading-relaxed text-ink-muted">{excerpt(post.content_html, 200)}</p>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {details.map((tile) => (
              <div key={tile.label} className="rounded-lg border border-hairline-soft bg-surface-1/80 p-2.5">
                <div className="flex items-center gap-1.5 text-micro font-medium uppercase tracking-wider text-ink-muted">
                  <span className="material-symbols-outlined text-[13px] text-accent-blue" aria-hidden="true">
                    {tile.icon}
                  </span>
                  {tile.label}
                </div>
                <div className="mt-1 text-body-sm font-semibold text-ink">{tile.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1">
            <Button variant="accent" size="sm" asChild>
              <Link href={`/articulos/${slug}`}>
                {dict.breakingPost.readFullArticle}
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={share}>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                share
              </span>
              {dict.breakingPost.share}
            </Button>
            <span className="inline-flex items-center gap-1.5 text-micro text-ink-muted">
              <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-gradient-violet to-gradient-magenta text-[9px] font-bold text-canvas">
                {authorInitial}
              </span>
              {authorName}
            </span>
          </div>
        </div>

        <div className="relative min-h-[280px] lg:min-h-full overflow-hidden border-t lg:border-t-0 lg:border-l border-hairline-soft">
          <MediaPreview src={post.cover_image_url} icon={meta.icon} mediaGradient={meta.media} symbol={symbol} />
          <div className="absolute top-3 left-3 rounded-lg border border-hairline bg-surface-container-lowest/90 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="block font-mono text-sm font-bold text-gradient-coral">{symbol ?? meta.name}</span>
          </div>
        </div>
      </div>
    </section>
  )
}