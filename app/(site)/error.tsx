'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useDictionary } from '@/lib/i18n/LocaleProvider'

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dict = useDictionary().siteError
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pt-[var(--header-height)]">
      <div className="max-w-md py-16 text-center">
        <span className="material-symbols-outlined mb-4 text-[48px] text-semantic-warning" aria-hidden="true">
          error
        </span>
        <h1 className="mb-3 text-headline text-ink">{dict.heading}</h1>
        <p className="mb-8 text-body text-on-surface-variant">{dict.body}</p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="btn-primary">
            {dict.retry}
          </button>
          <Link href="/" className="btn-secondary">
            {dict.backToHome}
          </Link>
        </div>
      </div>
    </main>
  )
}
