import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { GLOSSARY } from '@/lib/glossary'
import { jsonLdString } from '@/lib/json-ld'
import { SITE_URL } from '@/lib/site'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: dict.learn.pageTitle,
    description: dict.learn.metaDescription,
    alternates: { canonical: '/aprende' },
  }
}

export default async function LearnPage() {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const isEnglish = locale === 'en'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: dict.learn.pageTitle,
    url: `${SITE_URL}/aprende`,
    hasDefinedTerm: GLOSSARY.map((entry) => ({
      '@type': 'DefinedTerm',
      name: isEnglish ? entry.termEn : entry.term,
      description: isEnglish ? entry.definitionEn : entry.definition,
      url: `${SITE_URL}/aprende#${entry.slug}`,
    })),
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pb-24 pt-[var(--header-height)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />

      <div className="mx-auto max-w-[1200px] px-6 pt-8 md:px-8">
        <Breadcrumbs items={[{ label: dict.learn.breadcrumbHome, href: '/' }, { label: dict.learn.breadcrumbLearn }]} />

        <h1 className="mb-2 text-display-lg-mobile font-bold text-ink sm:text-display-lg">{dict.learn.h1}</h1>
        <p className="mb-8 max-w-2xl text-body text-on-surface-variant">{dict.learn.body}</p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          <nav aria-label={dict.learn.glossaryNavAria} className="lg:sticky lg:top-[128px] lg:self-start">
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {GLOSSARY.map((entry) => (
                <li key={entry.slug}>
                  <a
                    href={`#${entry.slug}`}
                    className="block rounded-full border border-hairline bg-white/[0.04] px-3 py-1 text-micro text-ink-muted transition-colors hover:border-accent-blue hover:text-ink lg:rounded-lg lg:border-transparent lg:bg-transparent lg:py-1.5"
                  >
                    {isEnglish ? entry.termEn : entry.term}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <dl className="space-y-6">
            {GLOSSARY.map((entry) => (
              <div
                key={entry.slug}
                id={entry.slug}
                className="scroll-mt-[var(--header-scroll-offset)] rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6"
              >
                <dt className="mb-2 text-subhead font-bold text-ink">{isEnglish ? entry.termEn : entry.term}</dt>
                <dd className="text-body text-ink-muted">{isEnglish ? entry.definitionEn : entry.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </main>
  )
}
