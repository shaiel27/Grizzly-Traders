import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui'
import { RiskCalculator } from '@/components/ui/RiskCalculator'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: dict.tools.pageTitle,
    description: dict.tools.metaDescription,
    alternates: { canonical: '/herramientas' },
  }
}

export default async function ToolsPage() {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pb-24 pt-[var(--header-height)]">
      <div className="mx-auto max-w-[1200px] px-6 pt-8 md:px-8">
        <Breadcrumbs items={[{ label: dict.tools.breadcrumbHome, href: '/' }, { label: dict.tools.breadcrumbTools }]} />

        <h1 className="mb-2 text-display-lg-mobile font-bold text-ink sm:text-display-lg">{dict.tools.h1}</h1>
        <p className="mb-8 max-w-2xl text-body text-on-surface-variant">{dict.tools.body}</p>

        <div className="space-y-8">
          <RiskCalculator />

          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-8" aria-labelledby="pivot-tool-title">
            <h2 id="pivot-tool-title" className="mb-1 text-subhead font-bold text-ink">
              {dict.tools.pivotSectionTitle}
            </h2>
            <p className="mb-4 max-w-2xl text-body-sm text-ink-muted">{dict.tools.pivotSectionBody}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/pivot-points" className="btn-primary">
                {dict.tools.openPivotCalculator}
              </Link>
              <Link href="/aprende" className="btn-secondary">
                {dict.tools.viewGlossary}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
