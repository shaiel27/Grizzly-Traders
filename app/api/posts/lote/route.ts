import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { revalidatePosts } from '@/lib/cache'
import { programarCompletado } from '@/lib/completar'
import { loteSchema } from '@/lib/lote'
import { createEditorClient } from '@/lib/supabase/admin'
import { firstIssue } from '@/lib/validation'

// Acciones sobre varios artículos a la vez desde la lista del CMS (hasta 50): publicar, despublicar o borrar.
//   POST { accion: 'publicar' | 'despublicar' | 'borrar', ids: [uuid…] }
// Devuelve cuántos se cambiaron de verdad (los que ya estaban así o no existen no cuentan).

export const maxDuration = 120

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const parsed = loteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })
  const { accion, ids } = parsed.data
  const supabase = await createEditorClient()

  try {
    let cambiados: string[] = []
    if (accion === 'borrar') {
      // Traducciones, activos y etiquetas se borran en cascada
      const { data, error } = await supabase.from('posts').delete().in('id', ids).select('id')
      if (error) throw error
      cambiados = (data ?? []).map((f: { id: string }) => f.id)
    } else if (accion === 'publicar') {
      // Se conserva la fecha original de publicación; solo se pone la de hoy a los que nunca se publicaron
      const { error: errFecha } = await supabase.from('posts').update({ published_at: new Date().toISOString() }).in('id', ids).is('published_at', null)
      if (errFecha) throw errFecha
      const { data, error } = await supabase.from('posts').update({ status: 'published' }).in('id', ids).neq('status', 'published').select('id')
      if (error) throw error
      cambiados = (data ?? []).map((f: { id: string }) => f.id)
    } else {
      const { data, error } = await supabase.from('posts').update({ status: 'draft' }).in('id', ids).neq('status', 'draft').select('id')
      if (error) throw error
      cambiados = (data ?? []).map((f: { id: string }) => f.id)
    }

    if (cambiados.length > 0) revalidatePosts()
    // Lo recién publicado también completa lo que le falte (portada, categoría, traducción)
    if (accion === 'publicar') for (const id of cambiados) await programarCompletado(supabase, id, auth.user.email)

    return NextResponse.json({ success: true, data: { accion, pedidos: ids.length, cambiados: cambiados.length } })
  } catch (error) {
    console.error('Acción en lote falló:', error)
    return NextResponse.json({ success: false, error: 'No se pudo completar la acción. Revisa la lista: puede que algunos sí se hayan cambiado.' }, { status: 500 })
  }
}
