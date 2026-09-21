import { NextResponse } from 'next/server'
import { revalidateContent } from '@/lib/cache'
import { requireEditor } from '@/lib/auth'
import { createEditorClient } from '@/lib/supabase/admin'
import { patchPostSchema, postIdSchema, firstIssue } from '@/lib/validation'

export async function DELETE(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const id = postIdSchema.safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  const supabase = await createEditorClient()
  // Related rows (translations, assets, tags) are removed by ON DELETE CASCADE
  const { data, error } = await supabase.from('posts').delete().eq('id', id.data).select('id')

  if (error) {
    console.error('Delete post error:', error)
    return NextResponse.json({ success: false, error: 'No se pudo eliminar el artículo' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
  }

  revalidateContent()
  return NextResponse.json({ success: true, message: 'Artículo eliminado' })
}

export async function PATCH(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = patchPostSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })
  }

  const { id, status, is_featured } = parsed.data
  const supabase = await createEditorClient()

  const update: Record<string, unknown> = {}
  if (status !== undefined) update.status = status
  if (is_featured !== undefined) update.is_featured = is_featured

  if (status === 'published') {
    // Keep the original publication date when re-publishing
    const { data: current } = await supabase.from('posts').select('published_at').eq('id', id).maybeSingle()
    if (!current?.published_at) update.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase.from('posts').update(update).eq('id', id).select('id')

  if (error) {
    console.error('Update post error:', error)
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el artículo' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
  }

  revalidateContent()
  return NextResponse.json({ success: true, message: 'Artículo actualizado' })
}
