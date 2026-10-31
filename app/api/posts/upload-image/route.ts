import { NextResponse } from 'next/server'
import { requireEditor } from '@/lib/auth'
import { createEditorClient } from '@/lib/supabase/admin'
import { ImageError, MAX_UPLOAD_BYTES, processImage, storagePath, type ImageKind } from '@/lib/images/process'

// Sube una imagen del editor del CMS (cuerpo multipart: `file` y, opcional, `kind` = inline | cover). Solo editores.
// Devuelve la URL pública del bucket `post-images` ya convertida a WebP y sin metadatos.

export const runtime = 'nodejs'

const BUCKET = 'post-images'
const LIMIT = 40
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

// Tope por editor en memoria: frena un bucle o una pestaña descontrolada, no es una defensa contra un ataque
function allowed(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= LIMIT) {
    hits.set(userId, recent)
    return false
  }
  hits.set(userId, [...recent, now])
  return true
}

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(request: Request) {
  const auth = await requireEditor()
  if ('response' in auth) return auth.response
  if (!allowed(auth.user.id)) return fail('Demasiadas imágenes seguidas: espera un minuto', 429)

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_UPLOAD_BYTES + 512 * 1024) return fail('La imagen supera los 10 MB', 413)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail('Formulario inválido', 400)
  }
  const file = form.get('file')
  if (!(file instanceof File)) return fail('Falta el archivo', 400)
  const kind: ImageKind = form.get('kind') === 'cover' ? 'cover' : 'inline'

  try {
    const processed = await processImage(Buffer.from(await file.arrayBuffer()), kind)
    const path = storagePath(kind, processed.hash)
    const supabase = await createEditorClient()
    const { error } = await supabase.storage.from(BUCKET).upload(path, processed.webp, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    })
    if (error) {
      console.error('Upload image error:', error.message)
      return fail('No se pudo guardar la imagen', 502)
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ success: true, url: data.publicUrl, width: processed.width, height: processed.height })
  } catch (error) {
    if (error instanceof ImageError) return fail(error.message, error.code === 'too_large' ? 413 : 422)
    console.error('Upload image error:', error instanceof Error ? error.message : error)
    return fail('No se pudo procesar la imagen', 500)
  }
}
