import type { SupabaseClient } from '@supabase/supabase-js'
import type { Locale } from '@/lib/i18n/get-dictionary'
import type { PostTranslation } from '@/lib/types'
import { ProviderError, type EmailProvider } from '@/lib/email/provider'
import { renderDigestEmail, type DigestEmailPost } from '@/lib/email/templates'
import { excerpt, localizedPostContent } from '@/lib/feed'

export interface DigestPost {
  id: string
  publishedAt: string
  title: string
  slug: string
  description: string
  category: string | null
  readingMinutes: number | null
  sourceName: string | null
  // Idioma en que realmente está el texto: si falta la traducción, el artículo no entra en ese resumen
  resolvedLocale: Locale
  isFeatured: boolean
}

export interface SelectOptions {
  locale: Locale
  now: Date
  windowHours?: number
  max?: number
  // Con menos artículos que esto no se envía: un resumen casi vacío daña la confianza del suscriptor
  min?: number
}

export function selectDigestPosts(posts: DigestPost[], { locale, now, windowHours = 24, max = 5, min = 3 }: SelectOptions): DigestPost[] | null {
  const from = now.getTime() - windowHours * 60 * 60 * 1000
  const seen = new Set<string>()

  const eligible = posts
    .filter((post) => {
      if (seen.has(post.id)) return false
      seen.add(post.id)
      const time = Date.parse(post.publishedAt)
      return !Number.isNaN(time) && time >= from && time <= now.getTime() && post.resolvedLocale === locale && post.title.trim() !== '' && post.slug.trim() !== ''
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, max)

  if (eligible.length < min) return null

  // La noticia principal es la destacada más reciente entre las elegidas; si no hay, la más reciente
  const featured = eligible.find((post) => post.isFeatured)
  return featured ? [featured, ...eligible.filter((post) => post !== featured)] : eligible
}

// YYYY-MM-DD en la zona horaria del envío: es la clave que impide enviar dos resúmenes el mismo día
export function digestDateKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export interface DigestRepo {
  // true si este proceso es el único que enviará el resumen de ese día e idioma
  claim(dateKey: string, locale: Locale): Promise<boolean>
  complete(dateKey: string, locale: Locale, info: { broadcastId: string; postIds: string[] }): Promise<void>
  // Marca el intento como fallido para permitir reintentarlo
  fail(dateKey: string, locale: Locale): Promise<void>
}

export interface RunDigestInput {
  locale: Locale
  now: Date
  siteUrl: string
  logoUrl?: string
  postalAddress?: string
  timeZone: string
  loadPosts: (sinceIso: string, untilIso: string) => Promise<DigestPost[]>
  repo: DigestRepo
  provider: EmailProvider
  // Devuelve el correo armado sin enviarlo ni reservar el día
  dryRun?: boolean
  // Ventana de búsqueda en horas. Solo se respeta con dryRun (para ver el correo con artículos más viejos);
  // un envío real siempre usa las últimas 24 horas.
  windowHours?: number
}

export type DigestResult =
  | { status: 'sent'; broadcastId: string; count: number }
  | { status: 'dry_run'; subject: string; html: string; text: string; count: number }
  | { status: 'skipped'; reason: 'already_sent' | 'not_enough_posts' | 'missing_postal_address' }
  | { status: 'failed'; error: string }

export async function runDigest(input: RunDigestInput): Promise<DigestResult> {
  const { locale, now, provider, repo, timeZone } = input
  const siteUrl = input.siteUrl.replace(/\/+$/, '')
  const windowHours = input.dryRun && input.windowHours ? input.windowHours : 24
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

  const candidates = await input.loadPosts(since.toISOString(), now.toISOString())
  const selected = selectDigestPosts(candidates, { locale, now, windowHours })
  if (!selected) return { status: 'skipped', reason: 'not_enough_posts' }

  const posts: DigestEmailPost[] = selected.map((post) => ({
    title: post.title,
    url: `${siteUrl}/articulos/${post.slug}`,
    description: post.description,
    category: post.category,
    readingMinutes: post.readingMinutes,
    sourceName: post.sourceName,
  }))
  const email = renderDigestEmail({ locale, posts, siteUrl, logoUrl: input.logoUrl, postalAddress: input.postalAddress, date: now, timeZone })

  if (input.dryRun) return { status: 'dry_run', ...email, count: selected.length }

  // La dirección postal es obligatoria en cada envío comercial (CAN-SPAM): sin ella no se envía
  if (!input.postalAddress) return { status: 'skipped', reason: 'missing_postal_address' }

  const dateKey = digestDateKey(now, timeZone)
  if (!(await repo.claim(dateKey, locale))) return { status: 'skipped', reason: 'already_sent' }

  try {
    const { id } = await provider.sendBroadcast({ locale, name: `Resumen ${dateKey} (${locale})`, ...email })
    // Si esta escritura fallara, el día queda reservado: es preferible a enviar el resumen dos veces
    await repo.complete(dateKey, locale, { broadcastId: id, postIds: selected.map((post) => post.id) }).catch((error) => {
      console.error('Newsletter: la difusión salió pero no se pudo registrar', error instanceof Error ? error.message : error)
    })
    return { status: 'sent', broadcastId: id, count: selected.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido'
    // Solo se libera el día cuando el proveedor rechazó la difusión sin procesarla. Con un corte de red o un
    // timeout no se sabe si salió: se deja en "sending" y se revisa a mano en Resend antes de reintentar
    // (ver docs/newsletter.md), porque reenviarla duplicaría el correo a toda la lista.
    if (error instanceof ProviderError && error.retrySafe) {
      await repo.fail(dateKey, locale).catch(() => undefined)
      console.error('Newsletter: no se pudo enviar el resumen', message)
      return { status: 'failed', error: message }
    }
    console.error('Newsletter: no se sabe si el resumen salió; el día queda reservado hasta revisarlo', message)
    return { status: 'failed', error: `${message} (no se sabe si salió: revisa Resend antes de reintentar)` }
  }
}

// ---------------------------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------------------------

type RawEmbedded = { name: string } | { name: string }[] | null

function embeddedName(value: RawEmbedded): string | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0]?.name ?? null) : value.name
}

interface RawPost {
  id: string
  title: string
  slug: string
  content_html: string
  meta_title: string | null
  meta_description: string | null
  original_locale: string | null
  published_at: string | null
  reading_time_minutes: number | null
  is_featured: boolean
  category: RawEmbedded
  source: RawEmbedded
  translations: PostTranslation[] | null
}

const POST_COLUMNS =
  'id,title,slug,content_html,meta_title,meta_description,original_locale,published_at,reading_time_minutes,is_featured,category:categorias(name),source:fuentes(name),translations:posts_translations(*)'

export function toDigestPost(raw: RawPost, locale: Locale): DigestPost | null {
  if (!raw.published_at) return null
  const content = localizedPostContent({ ...raw, translations: raw.translations ?? [] }, locale)
  return {
    id: raw.id,
    publishedAt: raw.published_at,
    title: content.title,
    slug: content.slug,
    description: excerpt(content.metaDescription || content.contentHtml, 220),
    category: embeddedName(raw.category),
    readingMinutes: raw.reading_time_minutes,
    sourceName: embeddedName(raw.source),
    resolvedLocale: content.resolvedLocale,
    isFeatured: raw.is_featured,
  }
}

export function createPostLoader(client: SupabaseClient, locale: Locale) {
  return async (sinceIso: string, untilIso: string): Promise<DigestPost[]> => {
    const { data, error } = await client
      .from('posts')
      .select(POST_COLUMNS)
      .eq('status', 'published')
      .gte('published_at', sinceIso)
      .lte('published_at', untilIso)
      .order('published_at', { ascending: false })
      .limit(30)
    if (error) throw new Error(`No se pudieron cargar los artículos: ${error.message}`)
    return ((data ?? []) as unknown as RawPost[]).map((raw) => toDigestPost(raw, locale)).filter((post): post is DigestPost => post !== null)
  }
}

export function createDigestRepo(client: SupabaseClient): DigestRepo {
  const table = () => client.from('newsletter_digests')

  return {
    async claim(dateKey, locale) {
      const { error } = await table().insert({ digest_date: dateKey, locale, status: 'sending' })
      if (!error) return true
      if (error.code !== '23505') throw new Error(`No se pudo reservar el envío: ${error.message}`)

      // Ya había un intento ese día: solo se puede repetir si falló. Uno "en curso" o "enviado" se respeta
      // aunque se haya quedado colgado, porque duplicar un envío a toda la lista es peor que perder un día.
      const { data, error: retryError } = await table()
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('digest_date', dateKey)
        .eq('locale', locale)
        .eq('status', 'failed')
        .select('digest_date')
      if (retryError) throw new Error(`No se pudo reservar el envío: ${retryError.message}`)
      return (data?.length ?? 0) > 0
    },

    async complete(dateKey, locale, { broadcastId, postIds }) {
      const { error } = await table()
        .update({ status: 'sent', broadcast_id: broadcastId, post_ids: postIds, updated_at: new Date().toISOString() })
        .eq('digest_date', dateKey)
        .eq('locale', locale)
      if (error) throw new Error(error.message)
    },

    async fail(dateKey, locale) {
      const { error } = await table()
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('digest_date', dateKey)
        .eq('locale', locale)
      if (error) throw new Error(error.message)
    },
  }
}
