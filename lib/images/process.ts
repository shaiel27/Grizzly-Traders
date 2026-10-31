import { createHash } from 'node:crypto'
import sharp from 'sharp'

// Imágenes que sube el editor del CMS. Se comprueba el formato real con sharp (no se confía en el tipo MIME del
// navegador), se aplica la orientación EXIF y se descartan los metadatos (GPS, cámara), se limita el tamaño y se
// guarda siempre en WebP. SVG y GIF no se aceptan: el SVG puede llevar scripts y el GIF animado pesa demasiado.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const MAX_INPUT_PIXELS = 50_000_000
export const INLINE_MAX_WIDTH = 1600
export const COVER_SIZE = { width: 1536, height: 1024 } as const

export type ImageKind = 'inline' | 'cover'

export class ImageError extends Error {
  constructor(
    message: string,
    readonly code: 'unsupported_format' | 'too_large' | 'invalid_image'
  ) {
    super(message)
  }
}

const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp'])

export interface ProcessedImage {
  webp: Buffer
  width: number
  height: number
  // Primeros 16 caracteres hexadecimales del SHA-256 del resultado: nombre estable (la misma imagen no se duplica)
  hash: string
}

export async function processImage(input: Buffer, kind: ImageKind): Promise<ProcessedImage> {
  if (input.length === 0) throw new ImageError('Archivo vacío', 'invalid_image')
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError('La imagen supera los 10 MB', 'too_large')

  let format: string | undefined
  try {
    format = (await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).format
  } catch {
    throw new ImageError('No es una imagen válida', 'invalid_image')
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new ImageError('Solo se aceptan imágenes PNG, JPEG o WebP', 'unsupported_format')

  try {
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate()
    const pipeline =
      kind === 'cover'
        ? base.resize(COVER_SIZE.width, COVER_SIZE.height, { fit: 'cover', position: 'centre' })
        : base.resize({ width: INLINE_MAX_WIDTH, withoutEnlargement: true })
    const { data, info } = await pipeline.webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
    return { webp: data, width: info.width, height: info.height, hash: createHash('sha256').update(data).digest('hex').slice(0, 16) }
  } catch {
    throw new ImageError('No se pudo procesar la imagen', 'invalid_image')
  }
}

// Ruta dentro del bucket `post-images`
export function storagePath(kind: ImageKind, hash: string, now: Date = new Date()): string {
  return kind === 'cover' ? `covers/${hash}.webp` : `inline/${now.getUTCFullYear()}/${hash}.webp`
}
