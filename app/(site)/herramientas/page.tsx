import type { Metadata } from 'next'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui'
import { RiskCalculator } from '@/components/ui/RiskCalculator'

export const metadata: Metadata = {
  title: 'Herramientas de trading',
  description: 'Calculadora de tamaño de posición y riesgo, y acceso a la calculadora de puntos pivote.',
  alternates: { canonical: '/herramientas' },
}

export default function ToolsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pb-24 pt-[104px]">
      <div className="mx-auto max-w-[1200px] px-6 pt-8 md:px-8">
        <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Herramientas' }]} />

        <h1 className="mb-2 text-display-lg-mobile font-bold text-ink sm:text-display-lg">Herramientas</h1>
        <p className="mb-8 max-w-2xl text-body text-on-surface-variant">
          Utilidades para planificar tus operaciones. Son cálculos orientativos y no constituyen asesoramiento financiero.
        </p>

        <div className="space-y-8">
          <RiskCalculator />

          <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 md:p-8" aria-labelledby="pivot-tool-title">
            <h2 id="pivot-tool-title" className="mb-1 text-subhead font-bold text-ink">
              Puntos pivote
            </h2>
            <p className="mb-4 max-w-2xl text-body-sm text-ink-muted">
              Calcula soportes y resistencias con los métodos Clásico, Fibonacci, Camarilla, Woodie y DeMark, o consulta los niveles
              actuales de los principales activos.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/pivot-points" className="btn-primary">
                Abrir calculadora de pivotes
              </Link>
              <Link href="/aprende" className="btn-secondary">
                Ver glosario
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
