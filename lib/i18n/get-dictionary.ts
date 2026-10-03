import es from './dictionaries/es.json'
import en from './dictionaries/en.json'

export type Locale = 'es' | 'en'
export const LOCALES: readonly Locale[] = ['es', 'en']
export const DEFAULT_LOCALE: Locale = 'es'

// `es` is the source of truth for shape: every key that exists there is expected in `en` too.
export type Dictionary = typeof es

const dictionaries: Record<Locale, Dictionary> = { es, en: en as Dictionary }

export function hasLocale(value: string | null | undefined): value is Locale {
  return value === 'es' || value === 'en'
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE]
}

// Interpolates `{token}` placeholders, e.g. t(dict.common.pagination.page, { n: 3 }) -> "Página 3"
export function t(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value === undefined ? match : String(value)
  })
}

type JsonLeaf = string
type JsonNode = JsonLeaf | { [key: string]: JsonNode }

// Recursively collects dotted key paths from a dictionary object, e.g. "header.navNews".
function collectKeyPaths(node: JsonNode, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  return Object.entries(node).flatMap(([key, value]) => collectKeyPaths(value, prefix ? `${prefix}.${key}` : key))
}

// Returns key paths present in `base` but missing (or not a string) in `target` — used by the dev-mode
// parity warning and by lib/i18n/i18n.test.ts to assert the two dictionaries never drift apart.
export function findMissingKeys(base: Dictionary, target: Dictionary): string[] {
  const basePaths = collectKeyPaths(base as unknown as JsonNode)
  return basePaths.filter((path) => {
    const value = path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), target)
    return typeof value !== 'string'
  })
}

if (process.env.NODE_ENV !== 'production') {
  const missingInEn = findMissingKeys(es, en as Dictionary)
  const missingInEs = findMissingKeys(en as Dictionary, es)
  if (missingInEn.length > 0) {
    console.warn(`[i18n] Keys missing in en.json: ${missingInEn.join(', ')}`)
  }
  if (missingInEs.length > 0) {
    console.warn(`[i18n] Keys missing in es.json: ${missingInEs.join(', ')}`)
  }
}
