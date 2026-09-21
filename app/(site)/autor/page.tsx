import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAllAuthors } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Autores',
  description: 'Conoce al equipo de analistas de Grizzly Traders.',
}

export default async function AuthorsPage() {
  const authors = await getAllAuthors().catch(() => [])

  if (authors.length === 1) redirect(`/autor/${authors[0].slug}`)

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[104px] pb-24">
      <div className="mx-auto max-w-[1200px] px-6 md:px-8">
        <h1 className="mb-8 text-display-lg-mobile font-bold text-ink sm:text-display-lg">Autores</h1>

        {authors.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => (
              <li key={author.id}>
                <Link
                  href={`/autor/${author.slug}`}
                  className="block rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 transition-colors hover:border-accent-blue/50"
                >
                  <p className="text-headline font-bold text-ink">{author.full_name}</p>
                  {author.role && <p className="mt-1 text-body-sm font-medium text-accent-blue">{author.role}</p>}
                  {author.bio && <p className="mt-3 line-clamp-3 text-body-sm text-ink-muted">{author.bio}</p>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-muted">Aún no hay autores para mostrar.</p>
        )}
      </div>
    </main>
  )
}
