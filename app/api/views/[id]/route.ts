import { NextResponse } from 'next/server'
import { z } from 'zod'
import { incrementViewCount } from '@/lib/api'
import { isBot, shouldCountView } from '@/lib/views'

// Cuenta una visita de un artículo. Pública (la llama el navegador del lector con sendBeacon): ignora bots y
// repeticiones de la misma IP, y responde siempre 204 para no dar pistas ni bloquear la página.

export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return new NextResponse(null, { status: 204 })
  if (isBot(request.headers.get('user-agent'))) return new NextResponse(null, { status: 204 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (shouldCountView(ip, id)) await incrementViewCount(id)
  return new NextResponse(null, { status: 204 })
}
