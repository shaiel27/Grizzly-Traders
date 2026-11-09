import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEditor } from '@/lib/auth'
import { revalidatePosts } from '@/lib/cache'
import { programarCompletado, urlCompletar } from '@/lib/completar'
import { BUCKET, nombreEnBucket } from '@/lib/portadas'
import { createEditorClient } from '@/lib/supabase/admin'
import { firstIssue, postIdSchema } from '@/lib/validation'

// «Nueva portada»: quita la portada actual y lanza el flujo de completado, que genera otra. Responde 202 y sigue en segundo plano.
//   POST { id }
// El archivo anterior solo se borra del almacenamiento si ningún otro artículo lo usa.

export const maxDuration = 300

const bodySchema = z.object({ id: postIdSchema })

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })

  if (!urlCompletar()) {
    return NextResponse.json({ success: false, code: 'no_configurado', error: 'Falta configurar N8N_WEBHOOK_EDITORIAL en el servidor' }, { status: 503 })
  }

  const supabase = await createEditorClient()
  const { id } = parsed.data
  const { data: post, error } = await supabase.from('posts').select('id, status, cover_image_url, og_image_url').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ success: false, error: 'No se pudo leer el artículo' }, { status: 500 })
  if (!post) return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
  if (post.status !== 'published') {
    return NextResponse.json({ success: false, error: 'La portada nueva se genera al publicar el artículo' }, { status: 409 })
  }

  // Archivos que dejará de usar este artículo, salvo que otro artículo los comparta
  const propios = [...new Set([nombreEnBucket(post.cover_image_url), nombreEnBucket(post.og_image_url)].filter((n): n is string => n !== null))]
  const borrables: string[] = []
  for (const nombre of propios) {
    const { data: otros } = await supabase.from('posts').select('id').neq('id', id).or(`cover_image_url.like.%${nombre},og_image_url.like.%${nombre}`).limit(1)
    if (!otros || otros.length === 0) borrables.push(nombre)
  }

  const { error: errUpdate } = await supabase.from('posts').update({ cover_image_url: null, og_image_url: null }).eq('id', id)
  if (errUpdate) return NextResponse.json({ success: false, error: 'No se pudo quitar la portada actual' }, { status: 500 })
  if (borrables.length > 0) {
    const { error: errBorrado } = await supabase.storage.from(BUCKET).remove(borrables)
    if (errBorrado) console.error('Nueva portada: no se pudo borrar el archivo anterior (queda como huérfano):', errBorrado.message)
  }

  revalidatePosts()
  const faltantes = await programarCompletado(supabase, id, auth.user.email)
  return NextResponse.json({ success: true, data: { faltantes }, message: 'Generando la portada nueva…' }, { status: 202 })
}
