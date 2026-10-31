/* eslint-disable @next/next/no-html-link-for-pages -- esta página se renderiza sin layouts ni contexto del router: enlaces simples a propósito */
import type { Metadata } from 'next'
import { inter, serif } from './fonts'
import './globals.css'

// 404 de toda la aplicación (rutas que no existen). Con varios layouts raíz (sitio público y panel/acceso) no hay un
// único layout con el que componerla, así que Next la renderiza sin layouts: aquí va el <html> completo. No puede saber
// el idioma del lector sin renderizar, por eso el texto es bilingüe. Los enlaces rotos dentro del sitio que llaman a
// notFound() siguen usando app/(site)/[locale]/not-found.tsx, con cabecera y pie.
export const metadata: Metadata = {
  title: '404 | Grizzly Traders',
  robots: 'noindex',
}

export default function GlobalNotFound() {
  return (
    <html lang="es" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col items-center justify-center bg-canvas px-4 text-center text-on-surface">
        <div className="mb-4 text-9xl font-bold text-ink/10">404</div>
        <h1 className="mb-2 font-serif text-3xl font-bold text-ink">Página no encontrada</h1>
        <p className="mb-8 text-ink-muted">Page not found</p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <a href="/" className="btn-primary">
            Inicio / Home
          </a>
          <a href="/articulos" className="btn-secondary">
            Noticias / News
          </a>
        </div>
      </body>
    </html>
  )
}
