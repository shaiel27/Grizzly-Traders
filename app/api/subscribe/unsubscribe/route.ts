import { NextResponse } from 'next/server'
import { z } from 'zod'
import { clientIp, createRateLimiter } from '@/lib/newsletter/guards'
import { isMissingTable } from '@/lib/newsletter/repo'
import { getNewsletterRuntime } from '@/lib/newsletter/runtime'
import { requestUnsubscribe } from '@/lib/newsletter/subscribe'

// Pide la baja por correo: envía un enlace de confirmación a la propia dirección. Responde igual exista o no
// el correo, para no revelar quién está en la lista.

const schema = z.object({ email: z.string().max(254), locale: z.enum(['es', 'en']).optional() })
const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 })

function fail(code: string, status: number) {
  return NextResponse.json({ success: false, code }, { status })
}

export async function POST(request: Request) {
  if (limiter.exceeded(clientIp(request))) return fail('rate_limited', 429)

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('invalid_email', 400)

  const runtime = getNewsletterRuntime(request)
  if (!runtime) return fail('unavailable', 503)

  try {
    const result = await requestUnsubscribe(parsed.data.email, parsed.data.locale ?? 'es', runtime.deps)
    if (!result.ok) return fail(result.code, result.code === 'failed' ? 502 : 400)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsubscribe request error:', error)
    return isMissingTable(error) ? fail('unavailable', 503) : fail('failed', 500)
  }
}
