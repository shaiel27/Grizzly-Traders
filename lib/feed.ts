import type { Category, PostTranslation, PostWithRelations } from './types'

const CATEGORY_META: Record<string, { icon: string; name: string; chip: string; media: string; accent: string }> = {
  criptomonedas: {
    icon: 'currency_bitcoin',
    name: 'Criptomonedas',
    chip: 'text-gradient-orange border-gradient-orange/40 bg-gradient-orange/15',
    media: 'from-gradient-orange/25 via-gradient-magenta/10 to-transparent',
    accent: 'text-gradient-orange',
  },
  forex: {
    icon: 'currency_exchange',
    name: 'Forex',
    chip: 'text-accent-blue border-accent-blue/40 bg-accent-blue/15',
    media: 'from-gradient-violet/25 via-accent-blue-glow/15 to-transparent',
    accent: 'text-accent-blue',
  },
  'materias-primas': {
    icon: 'oil_barrel',
    name: 'Materias Primas',
    chip: 'text-gradient-coral border-gradient-coral/40 bg-gradient-coral/15',
    media: 'from-gradient-coral/25 via-gradient-orange/10 to-transparent',
    accent: 'text-gradient-coral',
  },
  acciones: {
    icon: 'monitoring',
    name: 'Acciones',
    chip: 'text-gradient-magenta border-gradient-magenta/40 bg-gradient-magenta/15',
    media: 'from-gradient-magenta/25 via-gradient-violet/10 to-transparent',
    accent: 'text-gradient-magenta',
  },
}

const DEFAULT_META = {
  icon: 'newspaper',
  name: 'Noticias',
  chip: 'text-ink-muted border-hairline bg-white/5',
  media: 'from-surface-bright/30 to-transparent',
  accent: 'text-ink-muted',
}

export function categoryMeta(category: Category | null | undefined) {
  return CATEGORY_META[category?.slug ?? ''] ?? DEFAULT_META
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'recientemente'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'hace 1 min'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}

export function sentimentMeta(sentiment: PostWithRelations['sentiment']) {
  switch (sentiment) {
    case 'bullish':
      return { label: 'Alcista', chip: 'text-semantic-success border-semantic-success/40 bg-semantic-success/10' }
    case 'bearish':
      return { label: 'Bajista', chip: 'text-semantic-danger border-semantic-danger/40 bg-semantic-danger/10' }
    default:
      return { label: 'Neutral', chip: 'text-ink-muted border-hairline bg-surface-2/60' }
  }
}

// Articles are looked up by their translation slug, so links must be built from it (not from posts.slug)
export function localizedPost(post: { title: string; slug: string; translations?: PostTranslation[] }) {
  const translation = post.translations?.find((t) => t.locale === 'es') ?? post.translations?.[0]
  return {
    title: translation?.title || post.title,
    slug: translation?.slug || post.slug,
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

