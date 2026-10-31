import type { ReactNode } from 'react'

// Fase 6 — páginas legales (BORRADOR técnico, pendiente de revisión legal externa antes de publicar).
// Layout compartido: solo provee el contenedor `<main>` + ancho de lectura; cada página pinta su
// propio breadcrumb/h1/TOC y envuelve el cuerpo en `.legal-body.prose` (ver app/(site)/legal/shared.tsx
// y el bloque .legal-body de globals.css, que mapea la paleta oscura al plugin de tipografía).
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 pt-[var(--header-height)] pb-24">
      <article className="section-container max-w-3xl pt-8">{children}</article>
    </main>
  )
}
