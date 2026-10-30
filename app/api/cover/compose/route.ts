import { NextResponse } from 'next/server'
import { bearerMatches } from '@/lib/newsletter/guards'
import { composeCover } from '@/lib/cover/compose'

// Compone la portada de un artículo: recibe la imagen generada (cuerpo binario PNG/JPEG/WebP) y devuelve un WebP de
// 1536×1024 con las banderas y los logos de activos que pide n8n. Lo llama el flujo de noticias con
//   Authorization: Bearer <PIPELINE_API_SECRET>
//   POST /api/cover/compose?flags=US,CN&assets=XAUUSD,BTC
// Sin secreto configurado la ruta queda desactivada, nunca abierta.

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024
const MAX_LIST = 12

function list(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[A-Za-z0-9/]{1,12}$/.test(item))
    .slice(0, MAX_LIST)
}

function fail(code: string, status: number) {
  return NextResponse.json({ success: false, code }, { status })
}

export async function POST(request: Request) {
  const secret = process.env.PIPELINE_API_SECRET
  if (!secret || secret.length < 32) return fail('unavailable', 503)
  if (!bearerMatches(request.headers.get('authorization'), secret)) return fail('unauthorized', 401)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) return fail('too_large', 413)
  const image = Buffer.from(await request.arrayBuffer())
  if (image.length === 0) return fail('empty_body', 400)
  if (image.length > MAX_BYTES) return fail('too_large', 413)

  const { searchParams } = new URL(request.url)
  try {
    const { webp, badges } = await composeCover({ image, flags: list(searchParams.get('flags')), assets: list(searchParams.get('assets')) })
    return new NextResponse(new Uint8Array(webp), {
      headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Cover-Badges': badges.join(',') },
    })
  } catch (error) {
    console.error('Cover compose error:', error instanceof Error ? error.message : error)
    return fail('invalid_image', 422)
  }
}
