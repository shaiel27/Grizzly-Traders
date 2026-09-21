import { NextResponse } from 'next/server'
import { revalidateContent } from '@/lib/cache'
import { requireEditor } from '@/lib/auth'
import { createEditorClient } from '@/lib/supabase/admin'
import { sanitizeArticleHtml, htmlToText } from '@/lib/sanitize'
import { publishSchema, firstIssue } from '@/lib/validation'

// Always assign to Grizzly Traders author
const GRIZZLY_AUTHOR_ID = 5

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = publishSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })
  }

  const input = parsed.data
  const contentHtml = sanitizeArticleHtml(input.content_html)
  if (!htmlToText(contentHtml)) {
    return NextResponse.json({ success: false, error: 'El contenido está vacío' }, { status: 400 })
  }

  const supabase = await createEditorClient()

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: input.title,
      slug: input.slug,
      content_html: contentHtml,
      sentiment: input.sentiment ?? null,
      cover_image_url: input.cover_image_url,
      og_image_url: input.og_image_url,
      source_url: input.source_url,
      source_id: input.source_id,
      status: input.status,
      scheduled_at: input.scheduled_at,
      category_id: input.category_id,
      is_featured: input.is_featured,
      author_id: GRIZZLY_AUTHOR_ID,
      reading_time_minutes: Math.max(1, Math.ceil(htmlToText(contentHtml).split(' ').length / 200)),
    })
    .select('id')
    .single()

  if (postError || !post) {
    console.error('Post insert error:', postError)
    const duplicate = postError?.code === '23505'
    return NextResponse.json(
      { success: false, error: duplicate ? 'Ya existe un artículo con ese slug o fuente' : 'No se pudo guardar el artículo' },
      { status: duplicate ? 409 : 500 }
    )
  }

  const steps: Array<{ label: string; run: () => PromiseLike<{ error: unknown }> }> = [
    {
      label: 'translation',
      run: () =>
        supabase.from('posts_translations').insert({
          post_id: post.id,
          locale: input.locale,
          title: input.title,
          slug: input.slug,
          content_html: contentHtml,
          meta_title: input.meta_title,
          meta_description: input.meta_description,
        }),
    },
  ]

  if (input.asset_ids.length > 0) {
    steps.push({
      label: 'assets',
      run: () =>
        supabase
          .from('post_activos')
          .insert(input.asset_ids.map((assetId) => ({ post_id: post.id, asset_id: assetId }))),
    })
  }

  if (input.tag_ids.length > 0) {
    steps.push({
      label: 'tags',
      run: () =>
        supabase
          .from('post_tags')
          .insert(input.tag_ids.map((tagId) => ({ post_id: post.id, tag_id: tagId }))),
    })
  }

  for (const step of steps) {
    const { error } = await step.run()
    if (error) {
      console.error(`Publish ${step.label} error:`, error)
      // Roll back so we never leave a post without its translation (child rows cascade)
      await supabase.from('posts').delete().eq('id', post.id)
      return NextResponse.json(
        { success: false, error: 'No se pudo guardar el artículo completo. No se realizó ningún cambio.' },
        { status: 500 }
      )
    }
  }

  revalidateContent()

  return NextResponse.json({
    success: true,
    data: { id: post.id, slug: input.slug },
    message: input.status === 'published' ? 'Artículo publicado' : 'Borrador guardado',
  })
}
