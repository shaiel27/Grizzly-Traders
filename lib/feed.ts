import type { AuthorProfile, Category, PostTranslation, PostWithRelations } from './types'
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

// Modelo A: `posts` guarda el original EN SU IDIOMA y `posts.original_locale` dice cuál es, así que
// los campos base (title/slug/content_html) NO son necesariamente españoles. La DB define la columna
// como `not null default 'es'`; este normalizador replica ese default para las filas/mocks que
// lleguen sin la columna, y es el ÚNICO sitio del frontend donde 'es' sigue siendo un supuesto.
function originalLocaleOf(post: { original_locale?: string | null }): Locale {
  return post.original_locale === 'en' || post.original_locale === 'es' ? post.original_locale : 'es'
}

interface ResolvedTranslation {
  row: PostTranslation | undefined
  // Idioma en el que el lector va a ver REALMENTE el texto.
  resolvedLocale: Locale
  // true cuando falta la fila del idioma pedido y hubo que caer a otro idioma. Cuando no hay
  // ninguna fila, los campos base están en `original_locale`, así que pedir ese mismo idioma
  // NO es un fallback: el lector recibe exactamente el idioma que pidió.
  isFallback: boolean
}

// Cascada única (Modelo A): locale activo -> `original_locale` del post -> cualquier fila que haya
// -> campos base del post (que están en `original_locale`).
//
// El escalón intermedio era 'es' a pelo; con el Modelo A eso significaba servir inglés sin aviso a
// quien pedía español en cuanto un post tuviera `original_locale='en'`.
function resolveTranslation(
  post: { original_locale?: string | null; translations?: PostTranslation[] },
  locale: Locale
): ResolvedTranslation {
  const original = originalLocaleOf(post)
  const requested = post.translations?.find((tr) => tr.locale === locale)
  if (requested) return { row: requested, resolvedLocale: locale, isFallback: false }

  const originalRow = post.translations?.find((tr) => tr.locale === original)
  if (originalRow) return { row: originalRow, resolvedLocale: original, isFallback: true }

  const anyRow = post.translations?.[0]
  if (anyRow) return { row: anyRow, resolvedLocale: anyRow.locale, isFallback: anyRow.locale !== locale }

  return { row: undefined, resolvedLocale: original, isFallback: original !== locale }
}

// Rol y bio del autor en el idioma activo. Los perfiles guardan el texto base en español y la
// traducción en bio_en/role_en; sin traducción se muestra el base (misma cascada que los artículos).
export function localizedAuthor(
  author: Pick<AuthorProfile, 'bio' | 'role' | 'bio_en' | 'role_en'>,
  locale: Locale
): { bio: string | null; role: string | null } {
  if (locale === 'en') return { bio: author.bio_en || author.bio, role: author.role_en || author.role }
  return { bio: author.bio, role: author.role }
}

// Articles are looked up by their translation slug, so links must be built from it (not from posts.slug).
export function localizedPost(
  post: { title: string; slug: string; original_locale?: string | null; translations?: PostTranslation[] },
  locale: Locale = 'es'
) {
  const { row } = resolveTranslation(post, locale)
  return {
    title: row?.title || post.title,
    slug: row?.slug || post.slug,
  }
}

export interface LocalizedPostContent {
  title: string
  slug: string
  contentHtml: string
  metaTitle: string | null
  metaDescription: string | null
  resolvedLocale: Locale
  // Idioma original del artículo, para que quien muestre el aviso pueda decir en qué idioma está
  // leyendo realmente (y no dar por hecho «español»).
  originalLocale: Locale
  // True cuando falta la fila del idioma pedido y el contenido cayó a otro idioma — en CUALQUIER
  // dirección, también es->en y en->es. El llamante debe avisar en vez de servir texto sin traducir
  // bajo un chrome traducido.
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
    original_locale?: string | null
    translations?: PostTranslation[]
  },
  locale: Locale = 'es'
): LocalizedPostContent {
  const { row, resolvedLocale, isFallback } = resolveTranslation(post, locale)
  return {
    title: row?.title || post.title,
    slug: row?.slug || post.slug,
    contentHtml: row?.content_html || post.content_html,
    metaTitle: row?.meta_title ?? null,
    metaDescription: row?.meta_description ?? null,
    resolvedLocale,
    originalLocale: originalLocaleOf(post),
    isFallback,
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

