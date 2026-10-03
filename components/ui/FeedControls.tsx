import Link from 'next/link'
import { clsx } from 'clsx'
import { categoryMeta } from '@/lib/feed'
import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

const FLOW_SLUGS = ['', 'forex', 'criptomonedas', 'materias-primas', 'acciones']

export function FeedControls({ category, locale = 'es' }: { category: string; locale?: Locale }) {
  const dict = getDictionary(locale)
  const flows = FLOW_SLUGS.map((slug) => ({
    slug,
    label: slug ? categoryMeta({ id: 0, name: '', slug, created_at: '', updated_at: '' }, locale).name : dict.feedControls.allFlows,
  }))

  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label={dict.feedControls.filterByCategoryAria}>
      {flows.map((flow) => {
        const active = category === flow.slug
        return (
          <Link
            key={flow.slug || 'all'}
            href={flow.slug ? `/?categoria=${flow.slug}` : '/'}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={clsx(
              'rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors',
              active
                ? 'border-accent-blue bg-accent-blue text-canvas'
                : 'border-hairline bg-white/[0.04] text-ink-muted hover:border-hairline hover:text-ink'
            )}
          >
            {flow.label}
          </Link>
        )
      })}
    </nav>
  )
}
