import Link from 'next/link'
import { Header, Footer } from '@/components/ui'

export default function NotFound() {
  return (
    <>
      <Header />

      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-4 pt-[var(--header-height)] text-center">
        <div className="max-w-md py-16">
          <div className="mb-4 text-9xl font-bold text-ink/10">404</div>
          <h1 className="mb-4 text-display-lg-mobile font-bold text-ink sm:text-display-lg">Página no encontrada</h1>
          <p className="mb-8 text-body-lg text-on-surface-variant">
            Lo sentimos, la página que buscas no existe o ha sido movida.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/" className="btn-primary">
              Volver al inicio
            </Link>
            <Link href="/articulos" className="btn-secondary">
              Ver todas las noticias
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
