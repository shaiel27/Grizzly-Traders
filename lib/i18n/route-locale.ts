import { notFound } from 'next/navigation'
import { locale } from 'next/root-params'
import { hasLocale, type Locale } from './get-dictionary'

// Idioma de la ruta pública (`app/(site)/[locale]`). Reemplaza a getServerLocale() en el sitio público: leer la cookie
// con cookies() volvía dinámica cada página. Solo en componentes de servidor (no en route handlers ni en el panel).
export async function getRouteLocale(): Promise<Locale> {
  const value = await locale()
  if (!hasLocale(value)) notFound()
  return value
}
