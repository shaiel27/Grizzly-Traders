import type { Category, PostTranslation, PostWithRelations } from './types'
import { getDictionary, t, type Locale } from './i18n/get-dictionary'

// Icon/chip/media are purely visual and locale-independent; only the display `name` comes from the
// dictionary (feed.category.*) so categoryMeta stays a single source of truth for both.
const CATEGORY_META: Record<string, { icon: string; chip: string; media: string; accent: string }> = {
  criptomonedas: {
    icon: 'currency_bitcoin',
    chip: 'text-gradient-orange border-gradient-orange/40 bg-gradient-orange/15',
    media: 'from-gradient-orange/25 via-gradient-magenta/10 to-transparent',
    accent: 'text-gradient-orange',
  },
  forex: {
    icon: 'currency_exchange',
    chip: 'text-accent-blue border-accent-blue/40 bg-accent-blue/15',
    media: 'from-gradient-violet/25 via-accent-blue-glow/15 to-transparent',
    accent: 'text-accent-blue',
  },
  'materias-primas': {
    icon: 'oil_barrel',
    chip: 'text-gradient-coral border-gradient-coral/40 bg-gradient-coral/15',
    media: 'from-gradient-coral/25 via-gradient-orange/10 to-transparent',
    accent: 'text-gradient-coral',
  },
  acciones: {
    icon: 'monitoring',
    chip: 'text-gradient-magenta border-gradient-magenta/40 bg-gradient-magenta/15',
    media: 'from-gradient-magenta/25 via-gradient-violet/10 to-transparent',
    accent: 'text-gradient-magenta',
  },
}

const DEFAULT_META = {
  icon: 'newspaper',
  chip: 'text-ink-muted border-hairline bg-white/5',
  media: 'from-surface-bright/30 to-transparent',
  accent: 'text-ink-muted',
}

// Server components call this directly with a `locale` resolved from the `gt_locale` cookie; client
// components (ArticleCard rendered under NewsGrid, BreakingPost, etc.) get it from useLocale() and pass
// it through. Defaulting to 'es' keeps every pre-i18n call site working unchanged.
export function categoryMeta(category: Category | null | undefined, locale: Locale = 'es') {
  const slug = category?.slug ?? ''
  const visual = CATEGORY_META[slug] ?? DEFAULT_META
  const dict = getDictionary(locale)
  const name = dict.feed.category[slug as keyof typeof dict.feed.category] ?? dict.feed.category.default
  return { ...visual, name }
}

export function timeAgo(iso: string | null, locale: Locale = 'es'): string {
  const dict = getDictionary(locale).feed.timeAgo
  if (!iso) return dict.unknown
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return dict.justNow
  if (minutes < 60) return t(dict.minutes, { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t(dict.hours, { n: hours })
  const days = Math.floor(hours / 24)
  return days === 1 ? dict.oneDay : t(dict.days, { n: days })
}

export function sentimentMeta(sentiment: PostWithRelations['sentiment'], locale: Locale = 'es') {
  const dict = getDictionary(locale).feed.sentiment
  switch (sentiment) {
    case 'bullish':
      return { label: dict.bullish, chip: 'text-semantic-success border-semantic-success/40 bg-semantic-success/10' }
    case 'bearish':
      return { label: dict.bearish, chip: 'text-semantic-danger border-semantic-danger/40 bg-semantic-danger/10' }
    default:
      return { label: dict.neutral, chip: 'text-ink-muted border-hairline bg-surface-2/60' }
  }
}

// Articles are looked up by their translation slug, so links must be built from it (not from posts.slug).
// Fallback cascade (Fase 5.3): active locale's translation -> 'es' translation -> the post's own
// base title/slug. The DB only has 'es' rows today, so EN visitors mostly land on the last two steps —
// expected, not a bug: n8n isn't generating 'en' posts_translations rows in this plan.
export function localizedPost(post: { title: string; slug: string; translations?: PostTranslation[] }, locale: Locale = 'es') {
  const translation =
    post.translations?.find((tr) => tr.locale === locale) ?? post.translations?.find((tr) => tr.locale === 'es') ?? post.translations?.[0]
  return {
    title: translation?.title || post.title,
    slug: translation?.slug || post.slug,
  }
}

export interface LocalizedPostContent {
  title: string
  slug: string
  contentHtml: string
  metaTitle: string | null
  metaDescription: string | null
  resolvedLocale: 'es' | 'en'
  // True when the active locale has no translation row of its own and the content fell back
  // (to 'es', or to the post's base fields) — the caller should show an honest notice rather
  // than silently rendering untranslated content under translated chrome.
  isFallback: boolean
}

// Same fallback cascade as localizedPost, extended with the body/meta fields that the article
// detail page needs and the card-level helper deliberately doesn't resolve.
export function localizedPostContent(
  post: {
    title: string
    slug: string
    content_html: string
    meta_title: string | null
    meta_description: string | null
    translations?: PostTranslation[]
  },
  locale: Locale = 'es'
): LocalizedPostContent {
  const translation =
    post.translations?.find((tr) => tr.locale === locale) ??
    post.translations?.find((tr) => tr.locale === 'es') ??
    post.translations?.[0]
  const resolvedLocale = translation?.locale ?? 'es'
  return {
    title: translation?.title || post.title,
    slug: translation?.slug || post.slug,
    contentHtml: translation?.content_html || post.content_html,
    metaTitle: translation?.meta_title ?? null,
    metaDescription: translation?.meta_description ?? null,
    resolvedLocale,
    isFallback: locale !== resolvedLocale,
  }
}

export function excerpt(html: string, length = 110): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= length) return text
  // Cut at a word boundary so the card never ends mid-word
  const cut = text.slice(0, length)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), length * 0.6))}…`
}

