import { NextResponse } from 'next/server'
import { z } from 'zod'
import { clientIp, createRateLimiter } from '@/lib/newsletter/guards'
import { isMissingTable } from '@/lib/newsletter/repo'
import { getNewsletterRuntime } from '@/lib/newsletter/runtime'
import { confirmUnsubscribe } from '@/lib/newsletter/subscribe'

// Confirma la baja con el token del correo. Igual que la confirmación del alta, solo acepta POST.

const schema = z.object({ token: z.string().min(10).max(200) })
const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30 })

function fail(code: string, status: number) {
  return NextResponse.json({ success: false, code }, { status })
}

export async function POST(request: Request) {
  if (limiter.exceeded(clientIp(request))) return fail('rate_limited', 429)

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('invalid', 400)

  const runtime = getNewsletterRuntime(request)
  if (!runtime) return fail('unavailable', 503)

  try {
    const result = await confirmUnsubscribe(parsed.data.token, runtime.deps)
    if (result === 'unsubscribed' || result === 'already') return NextResponse.json({ success: true, result })
    return fail(result, result === 'failed' ? 502 : 400)
  } catch (error) {
    console.error('Unsubscribe confirm error:', error)
    return isMissingTable(error) ? fail('unavailable', 503) : fail('failed', 500)
  }
}
