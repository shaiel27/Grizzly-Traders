import { DEFAULT_LOCALE, hasLocale, type Locale } from './get-dictionary'

// El sitio público vive bajo `app/(site)/[locale]/…` para poder prerenderizarse (ISR) en cada idioma, pero las URL
// que ve el lector NO llevan prefijo: `proxy.ts` reescribe `/articulos` a `/es/articulos` o `/en/articulos` según la
// cookie `gt_locale`. Este módulo es la parte pura de esa decisión (se prueba sin Next).

// Rutas que no son páginas del sitio público: API, recursos internos, panel y acceso, y callback de Supabase Auth
const NON_PUBLIC = ['/api', '/_next', '/cms', '/login', '/auth']

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

// `/feed.xml`, `/robots.txt`, `/logo.png`…: el último segmento tiene extensión
function hasFileExtension(pathname: string): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(pathname.split('/').pop() ?? '')
}

export function isPublicPagePath(pathname: string): boolean {
  if (NON_PUBLIC.some((prefix) => isUnder(pathname, prefix))) return false
  return !hasFileExtension(pathname)
}

export function localePrefixOf(pathname: string): Locale | null {
  const first = pathname.split('/')[1]
  return hasLocale(first) ? first : null
}

// Para componentes que comparan la ruta actual (`/markets`): por si el navegador llegara a exponer la ruta reescrita
export function stripLocalePrefix(pathname: string): string {
  const locale = localePrefixOf(pathname)
  if (!locale) return pathname
  return pathname.slice(locale.length + 1) || '/'
}

export type RewriteDecision =
  | { type: 'none' }
  | { type: 'rewrite'; to: string; locale: Locale }
  // Alguien entró con un prefijo (`/en/articulos`): se lleva a la URL canónica sin prefijo y se recuerda su idioma
  | { type: 'redirect'; to: string; locale: Locale }

export function resolveRewrite(pathname: string, cookieValue: string | undefined): RewriteDecision {
  if (!isPublicPagePath(pathname)) return { type: 'none' }
  const prefixed = localePrefixOf(pathname)
  if (prefixed) return { type: 'redirect', to: stripLocalePrefix(pathname), locale: prefixed }
  const locale = hasLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE
  return { type: 'rewrite', to: `/${locale}${pathname === '/' ? '' : pathname}`, locale }
}
