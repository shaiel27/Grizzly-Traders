import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDictionary } from '@/lib/i18n/get-dictionary'
import { clientIp, createRateLimiter } from '@/lib/newsletter/guards'
import { isMissingTable } from '@/lib/newsletter/repo'
import { getNewsletterRuntime } from '@/lib/newsletter/runtime'
import { requestSubscription } from '@/lib/newsletter/subscribe'

// Alta con doble confirmación: guarda al suscriptor como "pendiente" y le envía un enlace de confirmación.
// Los errores devuelven un código; el texto en el idioma de la persona lo pone el formulario.

const schema = z.object({
  email: z.string().max(254),
  consent: z.boolean().optional(),
  locale: z.enum(['es', 'en']).optional(),
  // Honeypot: las personas reales nunca rellenan este campo oculto. Se acepta cualquier valor aquí y se
  // comprueba más abajo: si el esquema lo rechazara, un bot recibiría un error distinto y sabría que cayó.
  website: z.string().max(500).optional(),
  sourceUrl: z.url().max(500).optional(),
})

const limiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 })

function fail(code: string, status: number) {
  return NextResponse.json({ success: false, code }, { status })
}

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (limiter.exceeded(ip)) return fail('rate_limited', 429)

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return fail('invalid_request', 400)
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) return fail('invalid_email', 400)

  // Un honeypot relleno recibe la misma respuesta que un alta real, para que los bots no aprendan nada
  if (parsed.data.website) return NextResponse.json({ success: true })

  const runtime = getNewsletterRuntime(request)
  if (!runtime) return fail('unavailable', 503)

  const locale = parsed.data.locale ?? 'es'

  try {
    const result = await requestSubscription(
      {
        email: parsed.data.email,
        consent: parsed.data.consent === true,
        locale,
        consentText: getDictionary(locale).newsletterForm.consentLabel,
        sourceUrl: parsed.data.sourceUrl ?? null,
        ip,
      },
      runtime.deps
    )

    if (!result.ok) return fail(result.code, result.code === 'failed' ? 502 : 400)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscribe error:', error)
    return isMissingTable(error) ? fail('unavailable', 503) : fail('failed', 500)
  }
}
