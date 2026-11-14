'use client'

import { clsx } from 'clsx'
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { categoryMeta, excerpt, localizedPostContent, sentimentMeta, timeAgo } from '@/lib/feed'
import { FEATURED_WINDOW_MS, isInFeaturedWindow } from '@/lib/featured-window'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import { SITE_NAME } from '@/lib/site'
import type { PostWithRelations } from '@/lib/types'
import { MediaPreview } from './MediaPreview'
import { Button } from './Button'

const SENTIMENT_TEXT: Record<string, string> = {
  bullish: 'text-semantic-success',
  bearish: 'text-semantic-danger',
  neutral: 'text-ink',
}

// setTimeout no admite retardos mayores que 2^31-1 ms; la ventana de 24 h cabe de sobra
const MAX_TIMEOUT_MS = 2 ** 31 - 1

// La página se sirve desde caché (revalidate 60 s) y el servidor ya descarta lo que pasó de 24 h.
// Aun así, una página en caché puede llegar a un lector minutos u horas después de generarse, o
// el lector puede dejar la pestaña abierta: este hook retira el bloque en el cliente en el
// momento exacto en que la publicación cumple 24 h, sin depender de que el servidor regenere.
function useFeaturedActive(publishedAt: string | null): boolean {
  const [active, setActive] = useState(true)
  useEffect(() => {
    const published = publishedAt ? Date.parse(publishedAt) : NaN
    const check = () => setActive(isInFeaturedWindow(publishedAt))
    // Primer chequeo diferido: setState dentro del timer, no síncrono en el efecto
    const first = setTimeout(check, 0)
    if (Number.isNaN(published)) return () => clearTimeout(first)
    const msLeft = published + FEATURED_WINDOW_MS - Date.now()
    const expire = setTimeout(check, Math.min(Math.max(msLeft, 0), MAX_TIMEOUT_MS))
    return () => {
      clearTimeout(first)
      clearTimeout(expire)
    }
  }, [publishedAt])
  return active
}

export function BreakingPost({ post }: { post: PostWithRelations }) {
  const { locale } = useLocale()
  const dict = useDictionary()
  const headingId = useId()
  const active = useFeaturedActive(post.published_at)
  const [copied, setCopied] = useState(false)
  const meta = categoryMeta(post.category, locale)
  const sent = sentimentMeta(post.sentiment, locale)
  const symbol = post.assets?.[0]?.symbol
  // Este componente ni siquiera pasaba por localizedPost: title/slug venian del campo BASE del
  // post, que con el Modelo A esta siempre en original_locale — el bug mas severo de los tres,
  // porque afectaba tambien al TITULAR (no solo al resumen, como en ArticleCard). Mismo patron,
  // mismo motivo: coincidia por casualidad mientras no habia traducciones 'en' de verdad.
  const { title, slug, contentHtml } = localizedPostContent(post, locale)
  // Mismo motivo que en ArticleCard: el respaldo es la marca, nunca una persona.
  const authorName = post.author?.full_name ?? SITE_NAME
  const authorInitial = authorName.charAt(0).toUpperCase()
  const assetSymbols = post.assets?.map((asset) => asset.symbol).join(', ')

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2200)
    return () => clearTimeout(id)
  }, [copied])

  if (!active) return null

  // Sin activos no se muestra la ficha: antes quedaba una caja con un guion
  const details = [
    { label: dict.breakingPost.sentimentTile, value: sent.label, tone: SENTIMENT_TEXT[post.sentiment] ?? 'text-ink' },
    { label: dict.breakingPost.categoryTile, value: meta.name, tone: 'text-ink' },
    ...(assetSymbols ? [{ label: dict.breakingPost.assetsTile, value: assetSymbols, tone: 'text-ink' }] : []),
  ]

  const share = async () => {
    const url = `${window.location.origin}/articulos/${slug}`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else if (navigator.clipboard) {
        // Escritorio: sin hoja de compartir nativa, se copia el enlace y se avisa
        await navigator.clipboard.writeText(url)
        setCopied(true)
      }
    } catch {
      /* el lector canceló la hoja de compartir */
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="group/card relative overflow-hidden rounded-2xl border border-hairline bg-surface-container-lowest p-1.5 transition-colors duration-200 hover:border-accent-cyan/30 focus-within:border-accent-cyan/40 motion-reduce:transition-none"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: 'radial-gradient(60% 80% at 92% 100%, rgba(79,195,255,0.09), transparent 62%)' }}
        aria-hidden="true"
      />
      <div className="relative grid overflow-hidden rounded-xl lg:grid-cols-[1.2fr_1fr]">
        <div className="relative z-10 flex flex-col gap-5 p-5 md:p-7">
          {/* Marca de consola: "❯ Destacado" + punto en vivo, una línea hairline y la antigüedad */}
          <div className="flex items-center gap-3 font-mono text-micro">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-cyan/30 bg-accent-cyan/[0.07] px-2 py-1 text-accent-cyan-soft">
              <span aria-hidden="true" className="text-accent-cyan">
                ❯
              </span>
              {dict.breakingPost.featuredBadge}
              <span className="relative ml-0.5 flex size-1.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent-cyan" />
              </span>
            </span>
            <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
            {/* Computed from Date.now(): server and client necessarily disagree, intentionally */}
            <time dateTime={post.published_at ?? undefined} className="shrink-0 text-ink-muted" suppressHydrationWarning>
              {timeAgo(post.published_at, locale)}
            </time>
          </div>

          <div>
            <h2
              id={headingId}
              className="font-serif text-[26px] font-bold leading-[1.15] tracking-[-0.015em] text-ink [overflow-wrap:anywhere] text-balance md:text-[32px]"
            >
              <Link
                href={`/articulos/${slug}`}
                className="rounded-sm transition-colors duration-150 hover:text-accent-cyan-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-cyan"
              >
                {title}
              </Link>
            </h2>
            <p className="mt-3 max-w-[62ch] text-body-sm leading-relaxed text-ink-muted line-clamp-3">{excerpt(contentHtml, 200)}</p>
          </div>

          <dl className="grid grid-cols-2 divide-x divide-hairline-soft overflow-hidden rounded-lg border border-hairline-soft bg-surface-1/60 sm:flex sm:w-fit sm:max-w-full">
            {details.map((tile, i) => (
              <div
                key={tile.label}
                className={clsx('min-w-0 px-3.5 py-2.5', details.length === 3 && i === 2 && 'col-span-2 border-t border-hairline-soft !border-l-0 sm:col-span-1 sm:border-t-0 sm:!border-l')}
              >
                <dt className="font-mono text-micro text-ink-muted">{tile.label}</dt>
                <dd className={clsx('mt-1 truncate text-body-sm font-semibold', tile.tone)}>{tile.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <Button variant="accent" size="md" asChild className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan">
              <Link href={`/articulos/${slug}`}>
                {dict.breakingPost.readFullArticle}
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  arrow_forward
                </span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={share}
              className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {copied ? 'check' : 'share'}
              </span>
              {copied ? dict.breakingPost.shareCopied : dict.breakingPost.share}
            </Button>
            <span role="status" className="sr-only">
              {copied ? dict.breakingPost.shareCopied : ''}
            </span>
            <span className="inline-flex items-center gap-1.5 text-micro text-ink-muted sm:ml-auto">
              <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-gradient-violet to-gradient-magenta text-[9px] font-bold text-canvas" aria-hidden="true">
                {authorInitial}
              </span>
              {authorName}
            </span>
          </div>
        </div>

        <div className="relative aspect-[16/9] overflow-hidden border-t border-hairline-soft lg:aspect-auto lg:min-h-[340px] lg:border-l lg:border-t-0">
          <MediaPreview src={post.cover_image_url} icon={meta.icon} mediaGradient={meta.media} symbol={symbol} sizes="(min-width: 1200px) 540px, (min-width: 1024px) 45vw, 100vw" />
          <div className="absolute left-3 top-3 rounded-md border border-hairline bg-surface-container-lowest/85 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="block font-mono text-micro font-semibold text-ink">{symbol ?? meta.name}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
