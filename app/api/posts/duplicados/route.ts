import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { limpiarBusqueda } from '@/lib/cms-articulos'
import { terminoDeBusqueda, titulosParecidos, type TituloCandidato } from '@/lib/lote'
import { createEditorClient } from '@/lib/supabase/admin'
import { postIdSchema } from '@/lib/validation'

// ¿Ya hay un artículo con un título parecido? El editor lo consulta al terminar de escribir el título, para no publicar lo mismo dos veces.
//   GET ?titulo=…&excluir=<id del artículo que se está editando>
// Solo avisa: nunca impide guardar.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const busqueda = new URL(request.url).searchParams
  const titulo = (busqueda.get('titulo') ?? '').trim().slice(0, 300)
  const excluir = postIdSchema.safeParse(busqueda.get('excluir'))
  const termino = limpiarBusqueda(terminoDeBusqueda(titulo))
  if (termino.length < 6) return NextResponse.json({ success: true, data: [] })

  const supabase = await createEditorClient()
  // Candidatos: mismas primeras palabras clave, de los últimos 30 días; la comparación fina se hace aquí
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const patron = '%' + termino.split(' ').join('%') + '%'
  const { data, error } = await supabase
    .from('posts_translations')
    .select('post_id, title, slug, posts!inner(created_at)')
    .ilike('title', patron)
    .gte('posts.created_at', desde)
    .limit(25)
  if (error) {
    console.error('Duplicados: error al buscar:', error)
    return NextResponse.json({ success: true, data: [] })
  }
  const parecidos = titulosParecidos(titulo, (data ?? []) as unknown as TituloCandidato[], excluir.success ? excluir.data : null)
  return NextResponse.json({ success: true, data: parecidos.map(({ post_id, title, slug }) => ({ id: post_id, title, slug })) })
}
