import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BUCKET,
  CONSERVAR_MAS_VISTAS,
  TOPE_POR_EJECUCION,
  detectarHuerfanos,
  estadoUso,
  fechaDeCorte,
  nombreEnBucket,
  nombresEnTexto,
  planificarBorrado,
  type ArchivoBucket,
  type Candidato,
} from '@/lib/portadas'

// Acceso a datos de la retención de portadas (ver lib/portadas.ts y docs/almacenamiento.md).
// Los archivos se borran SIEMPRE con la API de Storage: borrar filas de storage.objects por SQL deja el archivo físico.

const LOTE_BORRADO = 100
const LOTE_CONSULTA = 30

// Lista todos los archivos del bucket (con su tamaño); las carpetas se ven como entradas sin id y se omiten
export async function listarBucket(supabase: SupabaseClient): Promise<ArchivoBucket[]> {
  const archivos: ArchivoBucket[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, offset: desde, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    for (const f of data ?? []) {
      if (!f.id) continue
      archivos.push({ name: f.name, size: Number((f.metadata as { size?: number } | null)?.size ?? 0), createdAt: f.created_at ?? null })
    }
    if (!data || data.length < 1000) break
  }
  return archivos
}

// Todo archivo del bucket que algo sigue usando: portadas y og de TODOS los artículos, e imágenes dentro de textos
export async function archivosReferenciados(supabase: SupabaseClient): Promise<Set<string>> {
  const usados = new Set<string>()
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from('posts').select('cover_image_url, og_image_url').range(desde, desde + 999)
    if (error) throw error
    for (const f of data ?? []) {
      for (const u of [f.cover_image_url, f.og_image_url]) {
        const n = nombreEnBucket(u)
        if (n) usados.add(n)
      }
    }
    if (!data || data.length < 1000) break
  }
  for (const [tabla, columna] of [['posts', 'content_html'], ['posts_translations', 'content_html']] as const) {
    const { data, error } = await supabase.from(tabla).select(columna).like(columna, `%${BUCKET}%`)
    if (error) throw error
    for (const f of (data ?? []) as unknown as Record<string, string>[]) for (const n of nombresEnTexto(f[columna])) usados.add(n)
  }
  return usados
}

async function borrarArchivos(supabase: SupabaseClient, nombres: string[]) {
  for (let i = 0; i < nombres.length; i += LOTE_BORRADO) {
    const { error } = await supabase.storage.from(BUCKET).remove(nombres.slice(i, i + LOTE_BORRADO))
    if (error) throw error
  }
}

export interface InformeLimpieza {
  ensayo: boolean
  huerfanos: { archivos: number; mb: number }
  retencion: { articulos: number; archivos: number; omitidos: number; pendientes: number }
}

export async function limpiarHuerfanos(supabase: SupabaseClient, ensayo: boolean, ahora = Date.now()) {
  const [archivos, usados] = await Promise.all([listarBucket(supabase), archivosReferenciados(supabase)])
  const huerfanos = detectarHuerfanos(archivos, usados, ahora)
  if (!ensayo && huerfanos.length > 0) await borrarArchivos(supabase, huerfanos.map((h) => h.name))
  return { archivos: huerfanos.length, mb: Math.round(huerfanos.reduce((s, h) => s + h.size, 0) / 1e6), nombres: huerfanos.map((h) => h.name) }
}

// Retención: portadas de notas automáticas publicadas hace más de `dias`, salvo destacadas y las más vistas
export async function aplicarRetencion(supabase: SupabaseClient, ensayo: boolean, dias: number, ahora = Date.now()) {
  const { data: top, error: errTop } = await supabase.from('posts').select('id').order('view_count', { ascending: false }).limit(CONSERVAR_MAS_VISTAS)
  if (errTop) throw errTop
  const conservar = (top ?? []).map((f: { id: string }) => f.id)

  let consulta = supabase
    .from('posts')
    .select('id, cover_image_url, og_image_url', { count: 'exact' })
    .eq('origen', 'rss')
    .eq('status', 'published')
    .eq('is_featured', false)
    .lt('published_at', fechaDeCorte(ahora, dias))
    .like('cover_image_url', `%/${BUCKET}/%`)
    .order('published_at', { ascending: true })
    .limit(TOPE_POR_EJECUCION)
  if (conservar.length) consulta = consulta.not('id', 'in', `(${conservar.join(',')})`)
  const { data, error, count } = await consulta
  if (error) throw error
  const candidatos = (data ?? []) as Candidato[]

  // Nadie más debe usar esos archivos: otro artículo con la misma portada, o un texto que la incruste
  const protegidos = new Set<string>()
  const ids = new Set(candidatos.map((c) => c.id))
  const urls = candidatos.flatMap((c) => [c.cover_image_url, c.og_image_url]).filter((u): u is string => !!u)
  for (let i = 0; i < urls.length; i += LOTE_CONSULTA) {
    const trozo = urls.slice(i, i + LOTE_CONSULTA)
    const { data: otros, error: e } = await supabase.from('posts').select('id, cover_image_url, og_image_url').or(`cover_image_url.in.(${trozo.map((u) => `"${u}"`).join(',')}),og_image_url.in.(${trozo.map((u) => `"${u}"`).join(',')})`)
    if (e) throw e
    for (const o of otros ?? []) {
      if (ids.has(o.id)) continue
      for (const u of [o.cover_image_url, o.og_image_url]) {
        const n = nombreEnBucket(u)
        if (n) protegidos.add(n)
      }
    }
  }
  for (const n of await archivosEnTextos(supabase)) protegidos.add(n)

  const plan = planificarBorrado(candidatos, protegidos)
  if (!ensayo && plan.ids.length > 0) {
    await borrarArchivos(supabase, plan.nombres)
    for (let i = 0; i < plan.ids.length; i += LOTE_BORRADO) {
      const { error: e } = await supabase.from('posts').update({ cover_image_url: null, og_image_url: null }).in('id', plan.ids.slice(i, i + LOTE_BORRADO))
      if (e) throw e
    }
  }
  return { articulos: plan.ids.length, archivos: plan.nombres.length, omitidos: plan.omitidos, pendientes: Math.max(0, (count ?? 0) - candidatos.length) }
}

async function archivosEnTextos(supabase: SupabaseClient): Promise<Set<string>> {
  const usados = new Set<string>()
  for (const tabla of ['posts', 'posts_translations'] as const) {
    const { data, error } = await supabase.from(tabla).select('content_html').like('content_html', `%${BUCKET}%`)
    if (error) throw error
    for (const f of data ?? []) for (const n of nombresEnTexto((f as { content_html: string }).content_html)) usados.add(n)
  }
  return usados
}

export async function usoActual(supabase: SupabaseClient) {
  const archivos = await listarBucket(supabase)
  return { archivos: archivos.length, ...estadoUso(archivos.reduce((s, a) => s + a.size, 0)) }
}

export async function anotarEnLog(supabase: SupabaseClient, titulo: string) {
  const { error } = await supabase.from('pipeline_logs').insert({ timestamp: new Date().toISOString(), fuente: 'Retención de portadas', titulo, status: 'success', error_message: null })
  if (error) console.error('Retención de portadas: no se pudo anotar en el log:', error.message)
}
