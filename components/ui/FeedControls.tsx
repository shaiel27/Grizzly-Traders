import Link from 'next/link'
import { clsx } from 'clsx'

const FLOWS = [
  { label: 'Todos los Flujos', slug: '' },
  { label: 'Forex', slug: 'forex' },
  { label: 'Criptomonedas', slug: 'criptomonedas' },
  { label: 'Materias Primas', slug: 'materias-primas' },
  { label: 'Acciones Globales', slug: 'acciones' },
]

export function FeedControls({ category }: { category: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Filtrar noticias por categoría">
      {FLOWS.map((flow) => {
        const active = category === flow.slug
        return (
          <Link
            key={flow.slug || 'all'}
            href={flow.slug ? `/?categoria=${flow.slug}` : '/'}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={clsx(
              'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              active
                ? 'border-accent-blue bg-accent-blue text-white'
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
