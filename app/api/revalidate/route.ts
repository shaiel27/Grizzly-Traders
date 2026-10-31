import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateCatalog, revalidatePosts } from '@/lib/cache'
import { bearerMatches } from '@/lib/newsletter/guards'

// Caduca el caché del sitio. Lo llama n8n al terminar de publicar (el pipeline y el flujo del CMS escriben directo en
// Supabase, sin pasar por el sitio, y sin esto lo publicado tarda hasta 5 minutos en aparecer):
//   POST /api/revalidate   Authorization: Bearer <PIPELINE_API_SECRET>   cuerpo opcional {"scope":"posts"|"catalog"|"all"}
// Sin secreto configurado la ruta queda desactivada, nunca abierta.

export const runtime = 'nodejs'

const schema = z.object({ scope: z.enum(['posts', 'catalog', 'all']).default('posts') })

function fail(code: string, status: number) {
  return NextResponse.json({ success: false, code }, { status })
}

export async function POST(request: Request) {
  const secret = process.env.PIPELINE_API_SECRET
  if (!secret || secret.length < 32) return fail('unavailable', 503)
  if (!bearerMatches(request.headers.get('authorization'), secret)) return fail('unauthorized', 401)

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return fail('invalid_request', 400)

  const { scope } = parsed.data
  if (scope === 'posts' || scope === 'all') revalidatePosts()
  if (scope === 'catalog' || scope === 'all') revalidateCatalog()
  return NextResponse.json({ success: true, scope })
}
