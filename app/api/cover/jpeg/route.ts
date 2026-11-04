import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { isOwnStorageImage } from '@/lib/sanitize'

// Portada en JPEG para las comunidades (Telegram no siempre acepta WebP como foto):
//   GET /api/cover/jpeg?u=<URL pública de la portada en el bucket post-images>
// Pública, pero solo convierte imágenes del bucket propio (nunca una URL cualquiera: sería un proxy abierto). La URL de
// una portada no cambia, así que el resultado se cachea un año.

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024
const WIDTH = 1280

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams.get('u') ?? ''
  if (!isOwnStorageImage(source)) return new NextResponse(null, { status: 400 })

  try {
    const upstream = await fetch(source, { signal: AbortSignal.timeout(15_000) })
    if (!upstream.ok) return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 })
    const input = Buffer.from(await upstream.arrayBuffer())
    if (input.length > MAX_BYTES) return new NextResponse(null, { status: 413 })

    const jpeg = await sharp(input).resize({ width: WIDTH, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    return new NextResponse(new Uint8Array(jpeg), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
