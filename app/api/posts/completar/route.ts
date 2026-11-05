import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { faltantesDe, hayFaltantes, programarCompletado, urlCompletar } from '@/lib/completar'
import { createEditorClient } from '@/lib/supabase/admin'
import { firstIssue, postIdSchema } from '@/lib/validation'
import { z } from 'zod'

// Completa a mano lo que le falta a un artículo (portada, categoría, traducción): el botón "Completar" del CMS.
// Responde enseguida (202) y el trabajo sigue en segundo plano; el CMS consulta la lista hasta que no falte nada.
//   GET  ?id=…   qué le falta, sin hacer nada
//   POST {id}    lanza el completado

export const maxDuration = 300

const bodySchema = z.object({ id: postIdSchema })

export async function GET(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const id = postIdSchema.safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })

  const faltantes = await faltantesDe(await createEditorClient(), id.data)
  if (!faltantes) return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
  return NextResponse.json({ success: true, data: { faltantes, configurado: urlCompletar() !== null } })
}

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 })

  if (!urlCompletar()) {
    return NextResponse.json(
      { success: false, code: 'no_configurado', error: 'Falta configurar N8N_WEBHOOK_EDITORIAL en el servidor' },
      { status: 503 }
    )
  }

  const supabase = await createEditorClient()
  const faltantes = await programarCompletado(supabase, parsed.data.id, auth.user.email)
  if (!faltantes) return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })

  return NextResponse.json(
    { success: true, data: { faltantes, iniciado: hayFaltantes(faltantes) }, message: hayFaltantes(faltantes) ? 'Completando el artículo…' : 'No le falta nada' },
    { status: hayFaltantes(faltantes) ? 202 : 200 }
  )
}
