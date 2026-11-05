import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { calcularFaltantes } from '@/lib/completar'
import { createEditorClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  try {
    const supabase = await createEditorClient()
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, title, slug, status, sentiment, view_count, published_at, created_at, is_featured,
        cover_image_url, category_id, original_locale,
        pipeline_error, pipeline_attempts,
        category:categorias(name, slug),
        author:perfiles_autores(full_name),
        assets:post_activos(asset:activos(symbol, name)),
        tags:post_tags(tag:tags(name, slug)),
        translations:posts_translations(locale, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const posts = (data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      sentiment: p.sentiment,
      view_count: p.view_count,
      published_at: p.published_at,
      created_at: p.created_at,
      is_featured: p.is_featured,
      category: p.category,
      author: p.author,
      assets: Array.isArray(p.assets)
        ? p.assets.map((a: Record<string, unknown>) => (a as { asset: Record<string, unknown> }).asset).filter(Boolean)
        : [],
      tags: Array.isArray(p.tags)
        ? p.tags.map((t: Record<string, unknown>) => (t as { tag: Record<string, unknown> }).tag).filter(Boolean)
        : [],
      translations: Array.isArray(p.translations) ? p.translations : [],
      // Qué le falta al artículo (el CMS ofrece completarlo)
      faltantes: calcularFaltantes({
        cover_image_url: (p.cover_image_url as string | null) ?? null,
        category_id: (p.category_id as number | null) ?? null,
        original_locale: (p.original_locale as string | null) ?? null,
        locales: Array.isArray(p.translations) ? (p.translations as { locale: string }[]).map((t) => t.locale) : [],
      }),
      pipeline_error: p.pipeline_error ?? null,
      pipeline_attempts: p.pipeline_attempts ?? null,
    }))

    return NextResponse.json({ success: true, data: posts })
  } catch (error) {
    console.error('List posts error:', error)
    return NextResponse.json(
      { success: false, error: 'No se pudieron cargar los artículos', data: [] },
      { status: 500 }
    )
  }
}
