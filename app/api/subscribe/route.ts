import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createPublicClient } from '@/lib/supabase/public'

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // Honeypot: real visitors never fill this hidden field
  website: z.string().max(0).optional(),
})

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const attempts = new Map<string, number[]>()

function tooManyRequests(ip: string): boolean {
  const now = Date.now()
  const recent = (attempts.get(ip) ?? []).filter((time) => now - time < WINDOW_MS)
  recent.push(now)
  attempts.set(ip, recent)
  if (attempts.size > 5_000) attempts.clear()
  return recent.length > MAX_PER_WINDOW
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (tooManyRequests(ip)) {
    return NextResponse.json({ success: false, error: 'Demasiados intentos. Prueba más tarde.' }, { status: 429 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Solicitud inválida' }, { status: 400 })
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Introduce un correo válido' }, { status: 400 })
  }

  // A filled honeypot gets the same answer as a real signup so bots learn nothing
  if (parsed.data.website) return NextResponse.json({ success: true })

  const { error } = await createPublicClient().from('subscribers').insert({ email: parsed.data.email })

  if (error) {
    // Already subscribed: answer the same way to avoid revealing who is on the list
    if (error.code === '23505') return NextResponse.json({ success: true })

    console.error('Subscribe error:', error)
    const missingTable = error.code === '42P01' || error.code === 'PGRST205'
    return NextResponse.json(
      { success: false, error: missingTable ? 'La suscripción no está disponible todavía.' : 'No se pudo completar la suscripción.' },
      { status: missingTable ? 503 : 500 }
    )
  }

  return NextResponse.json({ success: true })
}
