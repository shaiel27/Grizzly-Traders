import type { Metadata } from 'next'
import { ForexCalendar } from '@/components/ui/ForexCalendar'
import { Breadcrumbs } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'

// title/description stay the static ES defaults on purpose, same as every other static
// `export const metadata` page in app/(site)/ (legal/*, buscar, articulos) and per the note in
// app/layout.tsx: making metadata request-dependent needs an async generateMetadata(), which is
// later-phase SEO/hreflang scope, not this pass.
export const metadata: Metadata = {
  title: 'Calendario económico',
  description:
    'Calendario económico forex en tiempo real, sincronizado con ForexFactory: publicaciones macro de EE.UU., eurozona, Reino Unido, Japón y más, con dato real, previsión y dato anterior.',
  alternates: { canonical: '/calendario' },
}

export default async function CalendarioPage() {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="mx-auto max-w-[900px] px-6 md:px-8 pt-8">
        <Breadcrumbs items={[{ label: dict.legal.breadcrumbHome, href: '/' }, { label: dict.calendar.breadcrumb }]} />
        <ForexCalendar headingLevel="h1" />
      </div>
    </main>
  )
}
