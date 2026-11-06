import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePosts } from '@/lib/cache'
import { bearerMatches } from '@/lib/newsletter/guards'
import { RETENCION_DIAS } from '@/lib/portadas'
import { aplicarRetencion, anotarEnLog, limpiarHuerfanos, usoActual } from '@/lib/portadas-db'
import { createServiceClient } from '@/lib/newsletter/repo'

// Mantenimiento diario del almacenamiento (ver docs/almacenamiento.md). Lo llama el servidor con
//   Authorization: Bearer <PIPELINE_API_SECRET>
//   POST /api/mantenimiento/portadas   { "ensayo": true|false }
// Por seguridad, sin cuerpo o sin `ensayo: false` explícito SOLO informa de lo que borraría (ensayo).
// Sin secreto configurado la ruta queda desactivada, nunca abierta.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const cuerpo = z.object({ ensayo: z.boolean().default(true), dias: z.number().int().min(7).max(365).default(RETENCION_DIAS) })

export async function POST(request: Request) {
  const secret = process.env.PIPELINE_API_SECRET
  if (!secret || secret.length < 32) return NextResponse.json({ success: false, code: 'unavailable' }, { status: 503 })
  if (!bearerMatches(request.headers.get('authorization'), secret)) return NextResponse.json({ success: false, code: 'unauthorized' }, { status: 401 })

  const parsed = cuerpo.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ success: false, code: 'invalid_body' }, { status: 400 })
  const { ensayo, dias } = parsed.data

  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ success: false, code: 'no_service_key' }, { status: 503 })

  try {
    const huerfanos = await limpiarHuerfanos(supabase, ensayo)
    const retencion = await aplicarRetencion(supabase, ensayo, dias)
    if (!ensayo && (huerfanos.archivos > 0 || retencion.articulos > 0)) {
      await anotarEnLog(supabase, `Portadas: ${retencion.articulos} de notas con más de ${dias} días y ${huerfanos.archivos} archivos huérfanos borrados`)
      if (retencion.articulos > 0) revalidatePosts()
    }
    const uso = await usoActual(supabase)
    return NextResponse.json({ success: true, ensayo, dias, huerfanos: { archivos: huerfanos.archivos, mb: huerfanos.mb }, retencion, uso })
  } catch (error) {
    console.error('Retención de portadas: error:', error)
    return NextResponse.json({ success: false, code: 'failed' }, { status: 500 })
  }
}
