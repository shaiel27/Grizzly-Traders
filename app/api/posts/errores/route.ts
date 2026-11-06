import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireEditor } from '@/lib/auth'
import { revalidatePosts } from '@/lib/cache'
import { DIAS_LIMPIEZA_ERRORES, FILTRO_ES_ERROR, esFilaDeError, tipoDeError } from '@/lib/cms-articulos'
import { createEditorClient } from '@/lib/supabase/admin'
import { firstIssue, postIdSchema } from '@/lib/validation'

// Restos de error del pipeline (reservas sin terminar, duplicados, fallos guardados): reintentar, descartar o limpiar los antiguos.
//   POST { accion: 'reintentar', id }     el pipeline vuelve a intentarlo en el próximo ciclo (si la noticia sigue en el feed)
//   POST { accion: 'descartar', id }      lo borra de la base
//   POST { accion: 'limpiar_antiguos' }   borra los de más de 7 días (lo mismo que hace solo la función SQL limpiar_errores_pipeline)
// Todas comprueban en el servidor que la fila ES un resto de error: nunca borran ni tocan un artículo publicado ni uno escrito en el CMS.

export const dynamic = 'force-dynamic'

const cuerpoSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('reintentar'), id: postIdSchema }),
  z.object({ accion: z.literal('descartar'), id: postIdSchema }),
  z.object({ accion: z.literal('limpiar_antiguos') }),
])

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const parsed = cuerpoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })
  const cuerpo = parsed.data

  const supabase = await createEditorClient()

  if (cuerpo.accion === 'limpiar_antiguos') {
    const limite = new Date(Date.now() - DIAS_LIMPIEZA_ERRORES * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('posts')
      .delete()
      .eq('origen', 'rss')
      .eq('status', 'draft')
      .or(FILTRO_ES_ERROR)
      .lt('created_at', limite)
      .select('id')
    if (error) {
      console.error('Limpiar errores:', error)
      return NextResponse.json({ success: false, error: 'No se pudo limpiar' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: { borradas: data?.length ?? 0 } })
  }

  const { data: fila, error: errorLectura } = await supabase
    .from('posts')
    .select('id, origen, status, slug, pipeline_error')
    .eq('id', cuerpo.id)
    .maybeSingle()
  if (errorLectura) return NextResponse.json({ success: false, error: 'No se pudo leer el elemento' }, { status: 500 })
  if (!fila) return NextResponse.json({ success: false, error: 'No existe (puede que ya se haya limpiado)' }, { status: 404 })
  if (!esFilaDeError(fila)) return NextResponse.json({ success: false, error: 'Eso no es un error del pipeline: no se toca desde aquí' }, { status: 409 })

  if (cuerpo.accion === 'descartar') {
    const { error } = await supabase.from('posts').delete().eq('id', fila.id)
    if (error) return NextResponse.json({ success: false, error: 'No se pudo descartar' }, { status: 500 })
    revalidatePosts()
    return NextResponse.json({ success: true })
  }

  // reintentar: un duplicado se ignoró a propósito y un rechazo del checklist se corrige editando el texto, no reintentando
  const tipo = tipoDeError(fila.slug, fila.pipeline_error)
  if (tipo === 'duplicado') return NextResponse.json({ success: false, error: 'Un duplicado no se reintenta: es una noticia que ya estaba publicada' }, { status: 409 })
  if (tipo === 'checklist') return NextResponse.json({ success: false, error: 'Lo rechazó el checklist editorial: edita el texto o descártalo' }, { status: 409 })
  const { error } = await supabase.from('posts').update({ pipeline_attempts: 0, pipeline_error: null }).eq('id', fila.id)
  if (error) return NextResponse.json({ success: false, error: 'No se pudo reintentar' }, { status: 500 })
  return NextResponse.json({ success: true })
}
