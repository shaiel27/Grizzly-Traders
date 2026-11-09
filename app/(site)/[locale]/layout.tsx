import type { ReactNode } from 'react'
import { Header, Footer } from '@/components/ui'
import { Analytics } from '@/components/analytics/Analytics'
import { PUBLICIDAD_ACTIVA } from '@/lib/publicidad'
import { getCategories } from '@/lib/api'
import { getRouteLocale } from '@/lib/i18n/route-locale'
import { getDictionary, LOCALES } from '@/lib/i18n/get-dictionary'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import { siteMetadata, siteViewport } from '../../metadata'
import { RootHtml } from '../../root-html'

export const metadata = siteMetadata
export const viewport = siteViewport

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

// Layout raíz del sitio público. El idioma llega por la ruta (`/es/…`, `/en/…`), que proxy.ts reescribe a partir de la
// cookie sin cambiar la URL que ve el lector: así las páginas se prerenderizan por idioma y se sirven desde caché.
export default async function SiteRootLayout({ children }: { children: ReactNode }) {
  const locale = await getRouteLocale()
  // La cinta de cotizaciones ya no viaja en el HTML (su caché de 15 s obligaría a regenerar cada página cada 15 s): el
  // LiveTicker la pide al montar. Un proveedor caído nunca debe romper la página.
  const categories = await getCategories()
    .then((list) => list.map(({ id, name, slug }) => ({ id, name, slug })))
    .catch(() => [])
  const dictionary = getDictionary(locale)

  return (
    <RootHtml locale={locale}>
      {/* Header is a client component and consumes {locale, dictionary} via useLocale()/useDictionary().
          Footer is a server component (no hooks), so it gets them as explicit props; its embedded <LocaleSwitcher>
          still works because it's a client component slotted into this same provider tree. */}
      <LocaleProvider locale={locale} dictionary={dictionary}>
        <Header categories={categories} />
        {children}
        <Footer categories={categories} locale={locale} dictionary={dictionary} />
        {/* Google Analytics con consentimiento previo; sin NEXT_PUBLIC_GA_MEASUREMENT_ID no hace nada (docs/analitica.md) */}
        <Analytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} publicidadActiva={PUBLICIDAD_ACTIVA} />
      </LocaleProvider>
    </RootHtml>
  )
}
