import { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { ArticleCard, Badge, Chip, Breadcrumbs } from '@/components/ui'
import { ShareButtons } from '@/components/ui/ShareButtons'
import { getPostBySlug, getPostViewCount, getRelatedPosts, incrementViewCount } from '@/lib/api'
import { htmlToText, sanitizeArticleHtml } from '@/lib/sanitize'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { jsonLdString } from '@/lib/json-ld'
import Image from 'next/image'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

const TWITTER_CARDS = ['summary', 'summary_large_image', 'player', 'app'] as const
type TwitterCard = (typeof TWITTER_CARDS)[number]

function normalizeTwitterCard(value: string | null | undefined): TwitterCard {
  return TWITTER_CARDS.includes(value as TwitterCard) ? (value as TwitterCard) : 'summary_large_image'
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const post = await getPostBySlug(slug)
    const translation = post.translations?.find((t) => t.locale === 'es') || post.translations?.[0]
    const title = translation?.title || post.title
    const description =
      translation?.meta_description || htmlToText(translation?.content_html || post.content_html).slice(0, 160)
    const image = post.og_image_url || post.cover_image_url
    const socialTitle = translation?.meta_title || title

    return {
      title,
      description,
      alternates: { canonical: `/articulos/${slug}` },
      openGraph: {
        title: socialTitle,
        description,
        url: `/articulos/${slug}`,
        images: image ? [image] : [],
        type: 'article',
        publishedTime: post.published_at || post.created_at,
        modifiedTime: post.updated_at || undefined,
        authors: post.author?.full_name ? [post.author.full_name] : [],
      },
      twitter: {
        card: normalizeTwitterCard(post.twitter_card),
        title: socialTitle,
        description,
        images: image ? [image] : [],
      },
    }
  } catch {
    return { title: 'Artículo no encontrado', robots: { index: false } }
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params

  let post
  try {
    post = await getPostBySlug(slug)
  } catch {
    notFound()
  }

  const userAgent = (await headers()).get('user-agent') ?? ''
  if (!BOT_PATTERN.test(userAgent)) {
    const postId = post.id
    after(() => incrementViewCount(postId))
  }

  // getPostBySlug is cached for 5 minutes; view_count would look frozen for that whole window
  // (and never reflect this same request's own increment, which runs after the response anyway).
  const liveViewCount = await getPostViewCount(post.id)
  const viewCount = liveViewCount ?? post.view_count

  const translation = post.translations?.find((t) => t.locale === 'es') || post.translations?.[0]
  const title = translation?.title || post.title
  const content = sanitizeArticleHtml(translation?.content_html || post.content_html)
  const publishedDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at)
  const timeAgo = formatDistanceToNow(publishedDate, { addSuffix: true, locale: es })
  const absoluteDate = format(publishedDate, "d 'de' MMMM 'de' yyyy", { locale: es })

  // Get related posts
  const assetIds = post.assets?.map((a) => a.id).filter(Boolean) || []
  const relatedPosts = await getRelatedPosts(post.id, post.category_id || null, assetIds, 3)

  const articleUrl = `${SITE_URL}/articulos/${slug}`
  const image = post.og_image_url || post.cover_image_url
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    datePublished: publishedDate.toISOString(),
    dateModified: post.updated_at || publishedDate.toISOString(),
    mainEntityOfPage: articleUrl,
    ...(image ? { image: [image] } : {}),
    author: { '@type': 'Person', name: post.author?.full_name ?? SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />

      <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
        <article className="section-container max-w-4xl pt-8">
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Noticias', href: '/articulos' },
              ...(post.category
                ? [{ label: post.category.name, href: `/articulos?categoria=${post.category.slug}` }]
                : []),
              { label: title },
            ]}
          />

          {/* Header Meta */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {post.category && <Chip href={`/articulos?categoria=${encodeURIComponent(post.category.slug)}`}>{post.category.name}</Chip>}
              <Badge sentiment={post.sentiment} />
              {post.source && (
                <Chip icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}>
                  {post.source.name}
                </Chip>
              )}
            </div>

            <h1 className="mb-4 font-serif text-[34px] font-bold leading-[1.12] tracking-[-0.02em] text-ink sm:text-[46px]">{title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-body-sm text-ink-muted mb-6">
              {post.author && (
                <Link href={`/autor/${post.author.slug}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {post.author.avatar_url ? (
                    <Image src={post.author.avatar_url} alt="" width={32} height={32} className="rounded-full" />
                  ) : (
                    <div className="size-8 rounded-full bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center">
                      <span className="text-accent-blue font-bold text-xs">
                        {post.author.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  )}
                  <span className="font-medium text-ink hover:text-accent-blue transition-colors">{post.author.full_name}</span>
                  {post.author.role && (
                    <span className="text-micro text-accent-blue">· {post.author.role}</span>
                  )}
                </Link>
              )}
              <time dateTime={publishedDate.toISOString()} title={timeAgo}>{absoluteDate}</time>
              {post.reading_time_minutes && (
                <>
                  <span>•</span>
                  <span>{post.reading_time_minutes} min lectura</span>
                </>
              )}
              <span>•</span>
              <span>{viewCount.toLocaleString()} vistas</span>
            </div>
          </header>

          {/* Cover Image */}
          {post.cover_image_url && (
            <div className="relative aspect-video mb-8 rounded-2xl overflow-hidden">
              <Image
                src={post.cover_image_url}
                alt=""
                fill
                sizes="(min-width: 896px) 896px, 100vw"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Content */}
          <div
            className="article-body prose prose-lg max-w-[68ch] font-serif prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-[1.8] prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-blockquote:font-normal prose-blockquote:not-italic prose-img:rounded-xl prose-img:border prose-img:border-hairline prose-figcaption:font-sans prose-table:font-sans prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Assets & Tags */}
          <footer className="mt-12 border-t border-hairline-soft pt-8">
            {((post.assets?.length ?? 0) > 0 || (post.tags?.length ?? 0) > 0) && (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                {post.assets?.map((asset) => (
                  <Chip
                    key={asset.id}
                    href={`/articulos?activo=${encodeURIComponent(asset.symbol)}`}
                    className="bg-surface-2 border-accent-blue/30 text-accent-blue"
                    icon={
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    }
                  >
                    {asset.symbol}
                  </Chip>
                ))}
                {post.tags?.map((tag) => (
                  <Chip key={tag.id} href={`/articulos?tag=${encodeURIComponent(tag.slug)}`} className="text-xs px-2 py-0.5">#{tag.name}</Chip>
                ))}
              </div>
            )}

            <ShareButtons title={title} url={articleUrl} />
          </footer>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-16" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-display-md font-bold text-ink mb-6">Artículos Relacionados</h2>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relatedPosts.map((relatedPost) => (
                  <li key={relatedPost.id}>
                    <ArticleCard post={relatedPost} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>

    </>
  )
}