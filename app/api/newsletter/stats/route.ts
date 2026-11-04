import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { createServiceClient, isMissingTable } from '@/lib/newsletter/repo'
import { getSubscriberStats } from '@/lib/newsletter/stats'

// Cifras de la lista de correo para el panel del CMS. Solo editores: la tabla de suscriptores no es pública y aquí
// salen únicamente conteos, nunca correos ni datos de nadie.

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response

  const client = createServiceClient()
  if (!client) return NextResponse.json({ success: false, code: 'no_configurado', error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor' }, { status: 503 })

  try {
    const stats = await getSubscriberStats(client)
    return NextResponse.json({ success: true, data: stats }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isMissingTable(error)) return NextResponse.json({ success: false, code: 'sin_migracion', error: 'La tabla de suscriptores no existe' }, { status: 503 })
    console.error('Newsletter stats error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, code: 'error', error: 'No se pudieron leer las cifras' }, { status: 500 })
  }
}
