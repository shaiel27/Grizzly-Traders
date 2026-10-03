import { NextResponse } from 'next/server'
import { revalidateContent } from '@/lib/cache'
import { requireEditor } from '@/lib/auth'
import { createEditorClient } from '@/lib/supabase/admin'
import { sanitizeArticleHtml, htmlToText } from '@/lib/sanitize'
import { patchPostSchema, postIdSchema, updatePostSchema, firstIssue } from '@/lib/validation'

// Below this plain-text length, a post shows as a headline-only tile instead of getting its own detail page
const BRIEF_TEXT_THRESHOLD = 350

// Full post, both translations and related ids, so the editor form can be repopulated for editing
export async function GET(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const id = postIdSchema.safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  const supabase = await createEditorClient()
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      id, sentiment, cover_image_url, og_image_url, source_url, source_id, status, scheduled_at,
      category_id, is_featured,
      translations:posts_translations(locale, title, slug, content_html, meta_title, meta_description),
      assets:post_activos(asset_id),
      tags:post_tags(tag_id)
    `)
    .eq('id', id.data)
    .maybeSingle()

  if (error) {
    console.error('Get post error:', error)
    return NextResponse.json({ success: false, error: 'No se pudo cargar el artículo' }, { status: 500 })
  }
  if (!post) {
    return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
  }

  const { assets, tags, ...rest } = post as typeof post & {
    assets: { asset_id: number }[]
    tags: { tag_id: number }[]
  }

  return NextResponse.json({
    success: true,
    data: {
      ...rest,
      asset_ids: assets.map((a) => a.asset_id),
      tag_ids: tags.map((t) => t.tag_id),
    },
  })
}

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

// Full edit: post fields, the translation for the submitted locale (updated or created), and the
// asset/tag associations (replaced wholesale — simpler and safe since the lists are small).
export async function PUT(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = updatePostSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })
  }

  const input = parsed.data
  const contentHtml = sanitizeArticleHtml(input.content_html)
  if (!htmlToText(contentHtml)) {
    return NextResponse.json({ success: false, error: 'El contenido está vacío' }, { status: 400 })
  }

  const supabase = await createEditorClient()

  const { data: current, error: currentError } = await supabase
    .from('posts')
    .select('published_at')
    .eq('id', input.id)
    .maybeSingle()
  if (currentError || !current) {
    return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
  }

  const postUpdate: Record<string, unknown> = {
    // `slug` intentionally not touched here: it is the internal/legacy field, the translation's own
    // slug (below) is what /articulos/[slug] actually resolves.
    sentiment: input.sentiment ?? null,
    cover_image_url: input.cover_image_url,
    og_image_url: input.og_image_url,
    source_url: input.source_url,
    source_id: input.source_id,
    status: input.status,
    scheduled_at: input.scheduled_at,
    category_id: input.category_id,
    is_featured: input.is_featured,
    format: htmlToText(contentHtml).length < BRIEF_TEXT_THRESHOLD ? 'brief' : 'article',
    reading_time_minutes: Math.max(1, Math.ceil(htmlToText(contentHtml).split(' ').length / 200)),
  }
  if (input.status === 'published' && !current.published_at) postUpdate.published_at = new Date().toISOString()

  const { error: postError } = await supabase.from('posts').update(postUpdate).eq('id', input.id)
  if (postError) {
    console.error('Update post error:', postError)
    const duplicate = postError.code === '23505'
    return NextResponse.json(
      { success: false, error: duplicate ? 'Ya existe otro artículo con esa fuente' : 'No se pudo actualizar el artículo' },
      { status: duplicate ? 409 : 500 }
    )
  }

  const { error: translationError } = await supabase
    .from('posts_translations')
    .upsert(
      {
        post_id: input.id,
        locale: input.locale,
        title: input.title,
        slug: input.slug,
        content_html: contentHtml,
        meta_title: input.meta_title,
        meta_description: input.meta_description,
      },
      { onConflict: 'post_id,locale' }
    )
  if (translationError) {
    console.error('Update translation error:', translationError)
    const duplicate = translationError.code === '23505'
    return NextResponse.json(
      {
        success: false,
        error: duplicate
          ? 'Ese slug ya lo usa otra traducción. Los demás cambios sí se guardaron.'
          : 'No se pudo guardar el contenido traducido. Los demás cambios sí se guardaron.',
      },
      { status: duplicate ? 409 : 500 }
    )
  }

  await supabase.from('post_activos').delete().eq('post_id', input.id)
  if (input.asset_ids.length > 0) {
    const { error } = await supabase
      .from('post_activos')
      .insert(input.asset_ids.map((assetId) => ({ post_id: input.id, asset_id: assetId })))
    if (error) console.error('Update post assets error:', error)
  }

  await supabase.from('post_tags').delete().eq('post_id', input.id)
  if (input.tag_ids.length > 0) {
    const { error } = await supabase
      .from('post_tags')
      .insert(input.tag_ids.map((tagId) => ({ post_id: input.id, tag_id: tagId })))
    if (error) console.error('Update post tags error:', error)
  }

  revalidateContent()

  return NextResponse.json({
    success: true,
    data: { id: input.id, slug: input.slug },
    message: input.status === 'published' ? 'Artículo actualizado y publicado' : 'Cambios guardados',
  })
}
