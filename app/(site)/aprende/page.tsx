import type { Metadata } from 'next'
import { Breadcrumbs } from '@/components/ui'
import { GLOSSARY } from '@/lib/glossary'
import { jsonLdString } from '@/lib/json-ld'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Glosario de trading',
  description: 'Definiciones de soporte, resistencia, puntos pivote, RSI, MACD, ATR y otros términos clave del análisis técnico.',
  alternates: { canonical: '/aprende' },
}

export default function LearnPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'Glosario de trading',
    url: `${SITE_URL}/aprende`,
    hasDefinedTerm: GLOSSARY.map((entry) => ({
      '@type': 'DefinedTerm',
      name: entry.term,
      description: entry.definition,
      url: `${SITE_URL}/aprende#${entry.slug}`,
    })),
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pb-24 pt-[var(--header-height)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />

      <div className="mx-auto max-w-[1200px] px-6 pt-8 md:px-8">
        <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Glosario' }]} />

        <h1 className="mb-2 text-display-lg-mobile font-bold text-ink sm:text-display-lg">Glosario de trading</h1>
        <p className="mb-8 max-w-2xl text-body text-on-surface-variant">
          Los conceptos que usamos en los artículos, los niveles de pivote y la terminal de mercados. Contenido educativo, no
          asesoramiento financiero.
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Índice del glosario" className="lg:sticky lg:top-[128px] lg:self-start">
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {GLOSSARY.map((entry) => (
                <li key={entry.slug}>
                  <a
                    href={`#${entry.slug}`}
                    className="block rounded-full border border-hairline bg-white/[0.04] px-3 py-1 text-micro text-ink-muted transition-colors hover:border-accent-blue hover:text-ink lg:rounded-lg lg:border-transparent lg:bg-transparent lg:py-1.5"
                  >
                    {entry.term}
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
                <dt className="mb-2 text-subhead font-bold text-ink">{entry.term}</dt>
                <dd className="text-body text-ink-muted">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </main>
  )
}
