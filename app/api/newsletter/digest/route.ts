import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Locale } from '@/lib/i18n/get-dictionary'
import { createDigestRepo, createPostLoader, runDigest, type DigestResult } from '@/lib/newsletter/digest'
import { bearerMatches } from '@/lib/newsletter/guards'
import { getNewsletterRuntime } from '@/lib/newsletter/runtime'

// Arma y envía el resumen diario. Lo dispara un cron (n8n o el del sistema) con
//   Authorization: Bearer <DIGEST_CRON_SECRET>
// Cuerpo opcional: { "locale": "es" | "en", "dryRun": true }. Con dryRun devuelve el correo armado (asunto, HTML y
// texto) sin enviarlo ni reservar el día: sirve para ver cómo quedaría el resumen con los artículos reales.

const schema = z.object({
  locale: z.enum(['es', 'en']).optional(),
  dryRun: z.boolean().optional(),
  // Solo con dryRun: busca artículos de las últimas N horas en lugar de las últimas 24
  windowHours: z.number().int().min(1).max(720).optional(),
})

function fail(code: string, status: number) {
  return NextResponse.json({ success: false, code }, { status })
}

export async function POST(request: Request) {
  const secret = process.env.DIGEST_CRON_SECRET
  // Sin secreto configurado la ruta queda desactivada: nunca abierta
  if (!secret || secret.length < 32) return fail('unavailable', 503)
  if (!bearerMatches(request.headers.get('authorization'), secret)) return fail('unauthorized', 401)

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return fail('invalid_request', 400)

  const runtime = getNewsletterRuntime(request)
  if (!runtime) return fail('unavailable', 503)

  const locales: Locale[] = parsed.data.locale ? [parsed.data.locale] : ['es', 'en']
  const timeZone = process.env.DIGEST_TIMEZONE || 'UTC'
  const results: Partial<Record<Locale, DigestResult>> = {}

  for (const locale of locales) {
    try {
      results[locale] = await runDigest({
        locale,
        now: new Date(),
        siteUrl: runtime.deps.siteUrl,
        logoUrl: runtime.deps.logoUrl,
        postalAddress: runtime.deps.postalAddress,
        timeZone,
        loadPosts: createPostLoader(runtime.client, locale),
        repo: createDigestRepo(runtime.client),
        provider: runtime.deps.provider,
        dryRun: parsed.data.dryRun,
        windowHours: parsed.data.windowHours,
      })
    } catch (error) {
      console.error(`Digest error (${locale}):`, error)
      results[locale] = { status: 'failed', error: error instanceof Error ? error.message : 'error desconocido' }
    }
  }

  return NextResponse.json({ success: true, results })
}
