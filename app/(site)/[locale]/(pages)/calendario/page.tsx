import type { Metadata } from 'next'
import { ForexCalendar } from '@/components/ui/ForexCalendar'
import { Breadcrumbs } from '@/components/ui'
import { AnunciosLaterales } from '@/components/ads/AnunciosLaterales'
import { getRouteLocale } from '@/lib/i18n/route-locale'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRouteLocale()
  const dict = getDictionary(locale).calendar
  return { title: dict.pageTitle, description: dict.metaDescription, alternates: { canonical: '/calendario' } }
}

export default async function CalendarioPage() {
  const locale = await getRouteLocale()
  const dict = getDictionary(locale)

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="relative mx-auto max-w-[900px] px-6 md:px-8 pt-8">
        <Breadcrumbs items={[{ label: dict.legal.breadcrumbHome, href: '/' }, { label: dict.calendar.breadcrumb }]} />
        <ForexCalendar headingLevel="h1" anuncio />
        <AnunciosLaterales pantalla="estrecho" />
      </div>
    </main>
  )
}
