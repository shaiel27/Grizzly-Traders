import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_VERSIONES, resumenVersion, type VersionListada, type VersionTexto } from '@/lib/historial'

// Acceso a la tabla posts_historial (migración 0014). Todo es TOLERANTE: si la tabla aún no existe o falla, el CMS sigue guardando; solo se pierde la
// versión anterior (y queda registrado en el log). Un historial roto nunca debe impedir que el editor guarde su trabajo.

export type Locale = 'es' | 'en'

export async function guardarVersion(supabase: SupabaseClient, datos: { postId: string; locale: Locale; version: VersionTexto; editor: string | null; motivo: 'edicion' | 'restauracion' }): Promise<boolean> {
  try {
    const { error } = await supabase.from('posts_historial').insert({
      post_id: datos.postId,
      locale: datos.locale,
      title: datos.version.title,
      content_html: datos.version.content_html,
      meta_title: datos.version.meta_title,
      meta_description: datos.version.meta_description,
      editado_por: datos.editor,
      motivo: datos.motivo,
    })
    if (error) {
      console.error('Historial: no se pudo guardar la versión anterior:', error.message)
      return false
    }
    await podar(supabase, datos.postId, datos.locale)
    return true
  } catch (e) {
    console.error('Historial: error inesperado:', e instanceof Error ? e.message : e)
    return false
  }
}

// Conserva solo las últimas MAX_VERSIONES de cada artículo e idioma
export async function podar(supabase: SupabaseClient, postId: string, locale: Locale): Promise<void> {
  const { data, error } = await supabase
    .from('posts_historial')
    .select('id')
    .eq('post_id', postId)
    .eq('locale', locale)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(MAX_VERSIONES, MAX_VERSIONES + 200)
  if (error || !data?.length) return
  await supabase
    .from('posts_historial')
    .delete()
    .in(
      'id',
      data.map((f: { id: number }) => f.id)
    )
}

export async function listarVersiones(supabase: SupabaseClient, postId: string, locale: Locale): Promise<VersionListada[]> {
  const { data, error } = await supabase
    .from('posts_historial')
    .select('id, created_at, editado_por, motivo, title, content_html')
    .eq('post_id', postId)
    .eq('locale', locale)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_VERSIONES)
  if (error) throw error
  return (data ?? []).map((f: { id: number; created_at: string; editado_por: string | null; motivo: 'edicion' | 'restauracion'; title: string; content_html: string }) => ({
    id: f.id,
    created_at: f.created_at,
    editado_por: f.editado_por,
    motivo: f.motivo,
    title: f.title,
    resumen: resumenVersion(f.content_html),
  }))
}
