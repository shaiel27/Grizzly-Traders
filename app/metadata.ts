import type { Metadata, Viewport } from 'next'
import { SITE_URL } from '@/lib/site'

export const siteMetadata: Metadata = {
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

export const siteViewport: Viewport = {
  themeColor: '#090909',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}
