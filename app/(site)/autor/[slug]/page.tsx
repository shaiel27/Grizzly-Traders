import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Breadcrumbs, ArticleCard } from '@/components/ui'
import { getAuthorBySlug, getAuthorStats, getPostsByAuthor } from '@/lib/api'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary, t } from '@/lib/i18n/get-dictionary'
import type { AuthorProfile } from '@/lib/types'

interface AuthorPageProps {
  params: Promise<{ slug: string }>
}

async function loadAuthor(slug: string): Promise<AuthorProfile | null> {
  try {
    return await getAuthorBySlug(slug)
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params
  const author = await loadAuthor(slug)
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  if (!author) {
    return { title: dict.author.notFoundTitle, robots: { index: false } }
  }

  return {
    title: author.full_name,
    description: author.bio ?? t(dict.author.metaDescriptionFallback, { name: author.full_name }),
    alternates: { canonical: `/autor/${slug}` },
  }
}

const SOCIAL_LINK_DEFS = [
  { key: 'twitter_url', label: 'X / Twitter', icon: 'alternate_email' },
  { key: 'linkedin_url', label: 'LinkedIn', icon: 'work' },
] as const

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params
  const author = await loadAuthor(slug)
  if (!author) notFound()

  const locale = await getServerLocale()
  const dict = getDictionary(locale)

  const [posts, stats] = await Promise.all([
    getPostsByAuthor(author.id, locale).catch(() => []),
    getAuthorStats(author.id).catch(() => null),
  ])

  const initials = author.full_name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const statItems = [
    { label: dict.author.publishedArticles, value: stats?.posts ?? posts.length },
    { label: dict.author.marketsCovered, value: stats?.categories },
    { label: dict.author.assetsAnalyzed, value: stats?.assets },
  ].filter((item): item is { label: string; value: number } => typeof item.value === 'number')

  const socials = [
    ...SOCIAL_LINK_DEFS.filter((link) => author[link.key]),
    ...(author.website_url ? [{ key: 'website_url' as const, label: dict.author.website, icon: 'language' }] : []),
  ]

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <Breadcrumbs
          items={[
            { label: dict.author.breadcrumbHome, href: '/' },
            { label: dict.author.breadcrumbAuthors, href: '/autor' },
            { label: author.full_name },
          ]}
        />

        <section className="mb-12 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 md:p-10">
          <div className="flex flex-col items-start gap-8 md:flex-row">
            {author.avatar_url ? (
              <Image
                src={author.avatar_url}
                alt=""
                width={112}
                height={112}
                className="size-28 shrink-0 rounded-full border border-accent-blue/30 object-cover"
              />
            ) : (
              <div className="flex size-28 shrink-0 items-center justify-center rounded-full border border-accent-blue/30 bg-accent-blue/10">
                <span className="text-4xl font-bold text-accent-blue" aria-hidden="true">
                  {initials}
                </span>
              </div>
            )}

            <div className="flex-1">
              <h1 className="mb-2 font-serif text-display-md font-bold text-ink">{author.full_name}</h1>
              {author.role && <p className="mb-4 text-body font-bold text-accent-blue">{author.role}</p>}
              {author.bio && <p className="mb-6 max-w-2xl text-body text-ink-muted">{author.bio}</p>}

              {statItems.length > 0 && (
                <dl className="flex flex-wrap items-center gap-8">
                  {statItems.map((item) => (
                    <div key={item.label} className="flex flex-col">
                      {/* dt before dd in the DOM (correct <dl> order); order-* keeps the number shown above the label */}
                      <dt className="order-2 text-micro text-ink-muted">{item.label}</dt>
                      <dd className="order-1 text-display-sm font-bold text-ink">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {socials.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {socials.map((link) => (
                    <li key={link.key}>
                      <a
                        href={author[link.key] as string}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5 text-micro font-medium text-ink-muted transition-colors hover:border-accent-blue hover:text-ink"
                      >
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                          {link.icon}
                        </span>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="author-articles-heading">
          <h2 id="author-articles-heading" className="mb-6 text-headline text-ink">
            {dict.author.latestArticles}
          </h2>
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <ArticleCard key={post.id} post={post} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant/40 py-16 text-center">
              <span className="material-symbols-outlined mb-3 block text-5xl text-ink-subtle" aria-hidden="true">
                article
              </span>
              <p className="text-body text-ink-muted">{dict.author.noArticlesYet}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
