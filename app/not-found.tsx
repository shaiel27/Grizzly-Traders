import Link from 'next/link'
import { Header, Footer } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'

// Sits outside every route group (it's Next's global 404 fallback), so it never inherited
// (site)/layout.tsx's LocaleProvider — Header's useDictionary()/useLocale() crashed with a 500
// on every broken/mistyped URL, in any locale. Same class of bug as /login and /cms.
export default async function NotFound() {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)

  return (
    <LocaleProvider locale={locale} dictionary={dict}>
      <Header />

      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pt-[var(--header-height)] text-center">
        <div className="max-w-md py-16">
          <div className="mb-4 text-9xl font-bold text-ink/10">404</div>
          <h1 className="mb-4 text-display-lg-mobile font-bold text-ink sm:text-display-lg">{dict.notFound.heading}</h1>
          <p className="mb-8 text-body-lg text-on-surface-variant">{dict.notFound.body}</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/" className="btn-primary">
              {dict.notFound.backToHome}
            </Link>
            <Link href="/articulos" className="btn-secondary">
              {dict.notFound.viewAllNews}
            </Link>
          </div>
        </div>
      </main>

      <Footer locale={locale} dictionary={dict} />
    </LocaleProvider>
  )
}
