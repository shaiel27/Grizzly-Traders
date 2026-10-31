import Link from 'next/link'
import { getRouteLocale } from '@/lib/i18n/route-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

// 404 del sitio público: se renderiza dentro del layout de [locale] (con Header y Footer ya puestos). Los enlaces
// rotos llegan aquí por la ruta comodín `[...rest]`, que llama a notFound().
export default async function NotFound() {
  const locale = await getRouteLocale()
  const dict = getDictionary(locale)

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pt-[var(--header-height)] text-center">
      <div className="max-w-md py-16">
        <div className="mb-4 text-9xl font-bold text-ink/10">404</div>
        <h1 className="mb-4 font-serif text-display-lg-mobile font-bold text-ink sm:text-display-lg">{dict.notFound.heading}</h1>
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
  )
}
