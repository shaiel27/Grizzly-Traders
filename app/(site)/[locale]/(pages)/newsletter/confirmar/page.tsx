import type { Metadata } from 'next'
import Link from 'next/link'
import { NewsletterTokenAction } from '@/components/ui/NewsletterActions'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getRouteLocale } from '@/lib/i18n/route-locale'

interface ConfirmPageProps {
  searchParams: Promise<{ token?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getRouteLocale()).newsletterPages
  // Página de un solo uso con un token en la URL: que no se indexe
  return { title: dict.confirm.metaTitle, robots: { index: false, follow: false } }
}

export default async function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token } = await searchParams
  const dict = getDictionary(await getRouteLocale()).newsletterPages

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container pt-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-surface-container-lowest p-8">
          <h1 className="font-serif text-headline text-ink">{dict.confirm.title}</h1>
          {token ? (
            <>
              <p className="mb-6 mt-2 text-body text-ink-muted">{dict.confirm.body}</p>
              <NewsletterTokenAction mode="confirm" token={token} />
            </>
          ) : (
            <p className="mt-2 text-body text-semantic-danger">{dict.confirm.invalid}</p>
          )}
          <p className="mt-8 text-body-sm">
            <Link href="/" className="text-accent-blue hover:underline">
              {dict.backHome}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
