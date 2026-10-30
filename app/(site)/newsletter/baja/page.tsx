import type { Metadata } from 'next'
import Link from 'next/link'
import { NewsletterTokenAction, UnsubscribeRequestForm } from '@/components/ui/NewsletterActions'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { getServerLocale } from '@/lib/i18n/server'

interface UnsubscribePageProps {
  searchParams: Promise<{ token?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getServerLocale()).newsletterPages
  return { title: dict.unsubscribe.metaTitle, robots: { index: false, follow: false } }
}

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams
  const dict = getDictionary(await getServerLocale()).newsletterPages

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container pt-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-hairline bg-surface-container-lowest p-8">
          {token ? (
            <>
              <h1 className="font-serif text-headline text-ink">{dict.unsubscribe.confirmTitle}</h1>
              <p className="mb-6 mt-2 text-body text-ink-muted">{dict.unsubscribe.confirmBody}</p>
              <NewsletterTokenAction mode="unsubscribe" token={token} />
            </>
          ) : (
            <>
              <h1 className="font-serif text-headline text-ink">{dict.unsubscribe.requestTitle}</h1>
              <p className="mb-6 mt-2 text-body text-ink-muted">{dict.unsubscribe.requestBody}</p>
              <UnsubscribeRequestForm />
            </>
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
