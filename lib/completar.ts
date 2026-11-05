import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Completar artículos del CMS: portada, categoría y traducción.
//
// El modo Asistido genera todo en una sola llamada, pero el modo Manual (y editar un artículo ya guardado) solo guarda
// lo que el editor escribió. Para que ambos modos terminen igual, al guardar un artículo publicado el sitio calcula qué
// le falta y, si falta algo, avisa al flujo "CMS Completar articulo" de n8n, que genera solo lo que falta y NUNCA toca el
// texto del editor. Es idempotente: si no falta nada, no hay llamada y no cuesta nada.

export interface PostParaCompletar {
  cover_image_url: string | null
  category_id: number | null
  original_locale: string | null
  locales: string[]
  // Para el anuncio en Discord (solo los artículos del CMS, una sola vez)
  publicado?: boolean
  origen?: string | null
  anunciado_discord_at?: string | null
}

export interface Faltantes {
  portada: boolean
  categoria: boolean
  traduccion: boolean
  // Publicado desde el CMS y aún sin anunciar en Discord. No es algo que "falte" en el artículo: solo hace que se llame al flujo.
  anuncio: boolean
}

export function calcularFaltantes(post: PostParaCompletar): Faltantes {
  const original = post.original_locale && post.locales.includes(post.original_locale) ? post.original_locale : (post.locales[0] ?? 'es')
  const opuesto = original === 'es' ? 'en' : 'es'
  return {
    portada: !post.cover_image_url,
    categoria: post.category_id === null || post.category_id === undefined,
    // Sin ninguna versión escrita no hay qué traducir
    traduccion: post.locales.length > 0 && !post.locales.includes(opuesto),
    anuncio: post.publicado === true && post.origen === 'cms' && !post.anunciado_discord_at,
  }
}

export const hayFaltantes = (f: Faltantes) => f.portada || f.categoria || f.traduccion || f.anuncio

// La URL del flujo de completar es la del flujo editorial con otro final: así no hace falta otra variable. Se puede fijar
// aparte con N8N_WEBHOOK_COMPLETAR.
export function urlCompletar(env: Record<string, string | undefined> = process.env): string | null {
  const propia = env.N8N_WEBHOOK_COMPLETAR?.trim()
  if (propia) return propia
  const editorial = env.N8N_WEBHOOK_EDITORIAL?.trim()
  if (!editorial) return null
  return /\/cms-editorial\/?$/.test(editorial) ? editorial.replace(/\/cms-editorial\/?$/, '/cms-completar') : null
}

const respuestaSchema = z.object({
  ok: z.boolean(),
  hecho: z.object({ portada: z.boolean(), categoria: z.boolean(), traduccion: z.boolean() }).partial().optional(),
  pendientes: z.array(z.string()).optional(),
  errores: z.record(z.string(), z.string()).optional(),
  error: z.string().optional(),
})

export type ResultadoCompletar =
  | { estado: 'no_configurado' }
  | { estado: 'en_curso' }
  | { estado: 'error'; motivo: string }
  | { estado: 'listo'; pendientes: string[] }

const TIEMPO_MAXIMO_MS = 280_000
// Un artículo no se completa dos veces a la vez (doble clic, guardar dos veces seguidas): cada una costaría una imagen.
const enVuelo = new Set<string>()

export async function completarArticulo(postId: string, solicitadoPor?: string): Promise<ResultadoCompletar> {
  const url = urlCompletar()
  if (!url) return { estado: 'no_configurado' }
  if (enVuelo.has(postId)) return { estado: 'en_curso' }
  enVuelo.add(postId)
  try {
    const token = process.env.N8N_WEBHOOK_EDITORIAL_TOKEN?.trim()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ post_id: postId, solicitado_por: solicitadoPor ?? '' }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    })
    const json: unknown = await res.json().catch(() => null)
    const parsed = respuestaSchema.safeParse(json)
    if (!res.ok || !parsed.success) {
      const motivo = parsed.success ? (parsed.data.error ?? `n8n respondió ${res.status}`) : `respuesta inesperada de n8n (${res.status})`
      console.error('Completar artículo falló:', postId, motivo)
      return { estado: 'error', motivo }
    }
    if (parsed.data.pendientes?.length) console.error('Completar artículo: quedó pendiente', postId, parsed.data.pendientes, parsed.data.errores)
    return { estado: 'listo', pendientes: parsed.data.pendientes ?? [] }
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'error desconocido'
    console.error('Completar artículo no pudo llamar a n8n:', postId, motivo)
    return { estado: 'error', motivo }
  } finally {
    enVuelo.delete(postId)
  }
}

// Lee lo mínimo para saber qué falta, sin traer el contenido del artículo
export async function faltantesDe(supabase: SupabaseClient, postId: string): Promise<Faltantes | null> {
  const base = 'cover_image_url, category_id, original_locale, status, origen, translations:posts_translations(locale)'
  const leer = (columnas: string) => supabase.from('posts').select(columnas).eq('id', postId).maybeSingle<Record<string, unknown>>()
  let { data, error } = await leer(`${base}, anunciado_discord_at`)
  // Sin la columna del anuncio (migración 0010 aún sin aplicar) se sigue completando; solo no se anuncia
  if (error) ({ data, error } = await leer(base))
  if (error || !data) return null
  const traducciones = (data.translations ?? []) as { locale: string }[]
  return calcularFaltantes({
    cover_image_url: (data.cover_image_url as string | null) ?? null,
    category_id: (data.category_id as number | null) ?? null,
    original_locale: (data.original_locale as string | null) ?? null,
    locales: traducciones.map((t) => t.locale),
    publicado: data.status === 'published',
    origen: (data.origen as string | null) ?? null,
    anunciado_discord_at: (data.anunciado_discord_at as string | null) ?? null,
  })
}

// Para las rutas del CMS: responde al editor ya, y completa en segundo plano (`after` sigue corriendo cuando la respuesta
// ya salió). Devuelve qué faltaba para que la interfaz lo pueda mostrar.
export async function programarCompletado(supabase: SupabaseClient, postId: string, email?: string | null): Promise<Faltantes | null> {
  if (!urlCompletar()) return null
  const faltantes = await faltantesDe(supabase, postId)
  if (faltantes && hayFaltantes(faltantes)) after(() => completarArticulo(postId, email ?? undefined))
  return faltantes
}
