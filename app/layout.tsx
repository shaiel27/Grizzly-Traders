import type { Metadata, Viewport } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import { SITE_URL } from '@/lib/site'
import { getServerLocale } from '@/lib/i18n/server'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Editorial serif for headlines and long-form reading; the interface stays in Inter
const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Grizzly Traders - Inteligencia de Mercados Financieros',
    template: '%s | Grizzly Traders',
  },
  description: 'Noticias financieras en tiempo real, análisis de mercados, criptomonedas, forex, materias primas y acciones. Terminal de trading con IA.',
  keywords: ['trading', 'finanzas', 'criptomonedas', 'forex', 'acciones', 'análisis técnico', 'noticias financieras', 'mercados'],
  authors: [{ name: 'Grizzly Traders' }],
  creator: 'Grizzly Traders',
  publisher: 'Grizzly Traders',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: '/',
    siteName: 'Grizzly Traders',
    title: 'Grizzly Traders - Inteligencia de Mercados Financieros',
    description: 'Noticias financieras en tiempo real, análisis de mercados y terminal de trading con IA.',
    images: [{ url: '/logo.png', alt: 'Grizzly Traders' }],
  },
  twitter: {
    card: 'summary',
    title: 'Grizzly Traders - Inteligencia de Mercados',
    description: 'Noticias financieras en tiempo real, análisis de mercados y terminal de trading con IA.',
    images: ['/logo.png'],
    creator: '@grizzlytraders',
  },
  alternates: {
    types: { 'application/rss+xml': '/feed.xml' },
  },
}

export const viewport: Viewport = {
  themeColor: '#090909',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Only the <html lang> attribute is resolved dynamically here (Fase 5 MVP). title/description/openGraph.locale
  // stay the static ES defaults on purpose — making those request-dependent would require converting this static
  // `metadata` export into an async generateMetadata(), which is Fase 7 scope (SEO/hreflang), not MVP.
  const locale = await getServerLocale()

  return (
    <html lang={locale} className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <head>
        <link rel="preload" href="/fonts/material-symbols.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-on-surface">
        {children}
      </body>
    </html>
  )
}