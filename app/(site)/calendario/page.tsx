import type { Metadata } from 'next'
import { ForexCalendar } from '@/components/ui/ForexCalendar'

export const metadata: Metadata = {
  title: 'Calendario económico',
  description:
    'Calendario económico forex en tiempo real, sincronizado con ForexFactory: publicaciones macro de EE.UU., eurozona, Reino Unido, Japón y más, con dato real, previsión y dato anterior.',
  alternates: { canonical: '/calendario' },
}

export default function CalendarioPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="mx-auto max-w-[900px] px-6 md:px-8 pt-8">
        <ForexCalendar headingLevel="h1" />
      </div>
    </main>
  )
}
