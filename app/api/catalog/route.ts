import { NextResponse } from 'next/server'
import { revalidateContent } from '@/lib/cache'
import { requireEditor } from '@/lib/auth'
import { createEditorClient } from '@/lib/supabase/admin'
import { catalogCreateSchema, catalogIdSchema, catalogTypeSchema, firstIssue } from '@/lib/validation'

// Maps the request's discriminant to its table and the row shape to insert
const TABLES = {
  category: 'categorias',
  tag: 'tags',
  asset: 'activos',
  source: 'fuentes',
} as const

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = catalogCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })
  }

  const { type } = parsed.data
  const supabase = await createEditorClient()

  // Narrow explicitly per table: a single dynamic `.insert()` call can't type-check against a union of row shapes
  const { data, error } = await (async () => {
    switch (parsed.data.type) {
      case 'category':
        return supabase.from('categorias').insert({ name: parsed.data.name, slug: parsed.data.slug }).select().single()
      case 'tag':
        return supabase.from('tags').insert({ name: parsed.data.name, slug: parsed.data.slug }).select().single()
      case 'asset':
        return supabase
          .from('activos')
          .insert({ symbol: parsed.data.symbol, name: parsed.data.name, tipo_id: parsed.data.tipo_id })
          .select()
          .single()
      case 'source':
        return supabase
          .from('fuentes')
          .insert({ name: parsed.data.name, url: parsed.data.url, reliability_score: parsed.data.reliability_score })
          .select()
          .single()
    }
  })()

  if (error) {
    console.error(`Create ${type} error:`, error)
    const duplicate = error.code === '23505'
    return NextResponse.json(
      { success: false, error: duplicate ? 'Ya existe un elemento con ese nombre o slug' : 'No se pudo crear el elemento' },
      { status: duplicate ? 409 : 500 }
    )
  }

  revalidateContent()
  return NextResponse.json({ success: true, data })
}

export async function DELETE(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(request.url)
  const type = catalogTypeSchema.safeParse(searchParams.get('type'))
  const id = catalogIdSchema.safeParse(searchParams.get('id'))

  if (!type.success || !id.success) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const supabase = await createEditorClient()
  const { data, error } = await supabase.from(TABLES[type.data]).delete().eq('id', id.data).select('id')

  if (error) {
    console.error(`Delete ${type.data} error:`, error)
    // 23503: still referenced elsewhere and the foreign key does not cascade/null out (e.g. an asset type in use)
    const inUse = error.code === '23503'
    return NextResponse.json(
      { success: false, error: inUse ? 'No se puede eliminar: todavía está en uso' : 'No se pudo eliminar el elemento' },
      { status: inUse ? 409 : 500 }
    )
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
  }

  revalidateContent()
  return NextResponse.json({ success: true })
}
