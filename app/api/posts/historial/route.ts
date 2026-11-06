import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEditor } from '@/lib/auth'
import { revalidatePosts } from '@/lib/cache'
import { cambioRelevante } from '@/lib/historial'
import { guardarVersion, listarVersiones } from '@/lib/historial-db'
import { createEditorClient } from '@/lib/supabase/admin'
import { firstIssue, postIdSchema } from '@/lib/validation'

// Historial de versiones de un artículo (para deshacer una edición hecha por error).
//   GET  ?id=<post>&locale=es|en                 las últimas 20 versiones guardadas (la anterior a cada cambio)
//   POST { id, version_id }                       restaura esa versión; la versión actual se guarda antes, así que restaurar también se puede deshacer

export const dynamic = 'force-dynamic'

const localeSchema = z.enum(['es', 'en'])
const restaurarSchema = z.object({ id: postIdSchema, version_id: z.number().int().positive() })

export async function GET(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const busqueda = new URL(request.url).searchParams
  const id = postIdSchema.safeParse(busqueda.get('id'))
  const locale = localeSchema.safeParse(busqueda.get('locale'))
  if (!id.success || !locale.success) return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })

  try {
    const versiones = await listarVersiones(await createEditorClient(), id.data, locale.data)
    return NextResponse.json({ success: true, data: versiones })
  } catch (error) {
    console.error('Historial: error al listar:', error)
    // Lo más probable: la migración 0014 aún no se aplicó. La pantalla lo muestra como «sin historial», no como un fallo grave.
    return NextResponse.json({ success: false, error: 'No se pudo cargar el historial', data: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const parsed = restaurarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })

  const supabase = await createEditorClient()
  const { data: version, error: errorVersion } = await supabase
    .from('posts_historial')
    .select('id, post_id, locale, title, content_html, meta_title, meta_description')
    .eq('id', parsed.data.version_id)
    .eq('post_id', parsed.data.id)
    .maybeSingle()
  if (errorVersion) return NextResponse.json({ success: false, error: 'No se pudo leer la versión' }, { status: 500 })
  if (!version) return NextResponse.json({ success: false, error: 'Esa versión no existe (puede que ya se haya sustituido por otras más recientes)' }, { status: 404 })

  const { data: actual } = await supabase
    .from('posts_translations')
    .select('title, content_html, meta_title, meta_description')
    .eq('post_id', version.post_id)
    .eq('locale', version.locale)
    .maybeSingle()
  if (!actual) return NextResponse.json({ success: false, error: 'Ese idioma ya no existe en el artículo' }, { status: 404 })

  const restaurada = { title: version.title, content_html: version.content_html, meta_title: version.meta_title, meta_description: version.meta_description }
  // Lo que se va a sustituir se guarda primero: restaurar también se puede deshacer
  if (cambioRelevante(actual, restaurada)) {
    await guardarVersion(supabase, { postId: version.post_id, locale: version.locale, version: actual, editor: auth.user.email ?? null, motivo: 'restauracion' })
  }

  const { data: nueva, error } = await supabase
    .from('posts_translations')
    .update(restaurada)
    .eq('post_id', version.post_id)
    .eq('locale', version.locale)
    .select('updated_at')
    .maybeSingle()
  if (error) {
    console.error('Historial: no se pudo restaurar:', error)
    return NextResponse.json({ success: false, error: 'No se pudo restaurar la versión' }, { status: 500 })
  }

  revalidatePosts()
  return NextResponse.json({ success: true, data: { locale: version.locale, translation_updated_at: nueva?.updated_at ?? null } })
}
