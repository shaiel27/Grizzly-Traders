import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { calcularFaltantes } from '@/lib/completar'
import {
  FILTRO_ES_ERROR,
  FILTRO_NO_ES_ERROR,
  POR_PAGINA,
  leerParametrosLista,
  rangoDePagina,
  tipoDeError,
  type Ambito,
  type ArticuloLista,
  type Conteos,
} from '@/lib/cms-articulos'
import { createEditorClient } from '@/lib/supabase/admin'

// Lista del CMS, por ámbito (mis artículos / automáticos / errores del pipeline), con búsqueda, filtros y paginación en el servidor.
//   GET /api/posts/list?ambito=mis|auto|errores&estado=todos|published|draft|scheduled&q=…&categoria=id&fuente=id&pagina=n
// Antes devolvía solo los 50 más recientes: con ~100 notas automáticas al día, los artículos escritos a mano quedaban enterrados en horas.

export const dynamic = 'force-dynamic'

// El constructor de consultas de Supabase tiene un tipo genérico enorme; aquí solo se encadenan filtros, así que se tipa de forma laxa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Consulta = any

function aplicarAmbito(consulta: Consulta, ambito: Ambito): Consulta {
  if (ambito === 'mis') return consulta.eq('origen', 'cms')
  if (ambito === 'auto') return consulta.eq('origen', 'rss').or(FILTRO_NO_ES_ERROR)
  return consulta.eq('origen', 'rss').eq('status', 'draft').or(FILTRO_ES_ERROR)
}

const SELECCION = `
  id, title, slug, status, origen, sentiment, view_count, published_at, created_at, updated_at, is_featured, ai_assisted,
  cover_image_url, category_id, original_locale, source_url, source_id,
  pipeline_error, pipeline_attempts,
  category:categorias(name, slug),
  author:perfiles_autores(full_name),
  source:fuentes(name),
  assets:post_activos(asset:activos(symbol, name)),
  tags:post_tags(tag:tags(name, slug)),
  translations:posts_translations(locale, slug)
`

export async function GET(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const params = leerParametrosLista(new URL(request.url).searchParams)

  try {
    const supabase = await createEditorClient()

    // Lo listado (con todos los filtros)
    let consulta: Consulta = aplicarAmbito(supabase.from('posts').select(SELECCION, { count: 'exact' }), params.ambito)
    if (params.estado !== 'todos') consulta = consulta.eq('status', params.estado)
    if (params.categoria) consulta = consulta.eq('category_id', params.categoria)
    if (params.fuente) consulta = consulta.eq('source_id', params.fuente)
    if (params.q) consulta = consulta.ilike('title', `%${params.q}%`)
    const [desde, hasta] = rangoDePagina(params.pagina)
    const listado = consulta.order('created_at', { ascending: false }).range(desde, hasta)

    // Cuántos hay en cada ámbito (sin filtros), para los contadores de las pestañas
    const contar = (ambito: Ambito) => aplicarAmbito(supabase.from('posts').select('id', { count: 'exact', head: true }), ambito)
    const [lista, mis, auto, errores] = await Promise.all([listado, contar('mis'), contar('auto'), contar('errores')])
    if (lista.error) throw lista.error

    const articulos: ArticuloLista[] = ((lista.data ?? []) as Record<string, unknown>[]).map((p) => {
      const traducciones = Array.isArray(p.translations) ? (p.translations as { locale: 'es' | 'en'; slug: string }[]) : []
      return {
        id: p.id as string,
        title: p.title as string,
        slug: p.slug as string,
        status: p.status as string,
        origen: (p.origen as string | null) ?? null,
        sentiment: p.sentiment as string,
        view_count: (p.view_count as number) ?? 0,
        published_at: (p.published_at as string | null) ?? null,
        created_at: p.created_at as string,
        updated_at: (p.updated_at as string | null) ?? null,
        is_featured: !!p.is_featured,
        ai_assisted: (p.ai_assisted as boolean | null) ?? null,
        category: (p.category as ArticuloLista['category']) ?? null,
        author: (p.author as ArticuloLista['author']) ?? null,
        source: (p.source as ArticuloLista['source']) ?? null,
        source_url: (p.source_url as string | null) ?? null,
        assets: Array.isArray(p.assets) ? (p.assets as { asset: { symbol: string; name: string } }[]).map((a) => a.asset).filter(Boolean) : [],
        tags: Array.isArray(p.tags) ? (p.tags as { tag: { name: string; slug: string } }[]).map((t) => t.tag).filter(Boolean) : [],
        translations: traducciones,
        pipeline_error: (p.pipeline_error as string | null) ?? null,
        pipeline_attempts: (p.pipeline_attempts as number | null) ?? null,
        // Qué le falta al artículo (el CMS ofrece completarlo)
        faltantes: calcularFaltantes({
          cover_image_url: (p.cover_image_url as string | null) ?? null,
          category_id: (p.category_id as number | null) ?? null,
          original_locale: (p.original_locale as string | null) ?? null,
          locales: traducciones.map((t) => t.locale),
        }),
        tipo_error: params.ambito === 'errores' ? tipoDeError(p.slug as string, p.pipeline_error as string | null) : null,
      }
    })

    const conteos: Conteos = { mis: mis.count ?? 0, auto: auto.count ?? 0, errores: errores.count ?? 0 }
    return NextResponse.json({ success: true, data: articulos, total: lista.count ?? 0, pagina: params.pagina, porPagina: POR_PAGINA, conteos })
  } catch (error) {
    console.error('List posts error:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudieron cargar los artículos', data: [], total: 0, pagina: params.pagina, porPagina: POR_PAGINA, conteos: { mis: 0, auto: 0, errores: 0 } },
      { status: 500 }
    )
  }
}
