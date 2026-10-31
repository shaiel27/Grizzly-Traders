import type { ReactNode } from 'react'
import { getServerLocale } from '@/lib/i18n/server'
import { siteMetadata, siteViewport } from '../metadata'
import { RootHtml } from '../root-html'

export const metadata = siteMetadata
export const viewport = siteViewport

// Panel (/cms) y acceso (/login): no son páginas públicas, así que mantienen el idioma por cookie y se renderizan en
// cada petición. El sitio público tiene su propio layout raíz en app/(site)/[locale]/layout.tsx.
export default async function AppRootLayout({ children }: { children: ReactNode }) {
  return <RootHtml locale={await getServerLocale()}>{children}</RootHtml>
}
