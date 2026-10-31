import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ImageError, INLINE_MAX_WIDTH, MAX_UPLOAD_BYTES, processImage, storagePath } from './process'

const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#3366aa' } }).png().toBuffer()

describe('processImage', () => {
  it('convierte a WebP y limita el ancho de las imágenes del texto', async () => {
    const out = await processImage(await png(3000, 1500), 'inline')
    const meta = await sharp(out.webp).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', INLINE_MAX_WIDTH, 800])
    expect([out.width, out.height]).toEqual([INLINE_MAX_WIDTH, 800])
    expect(out.hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('no agranda las imágenes pequeñas', async () => {
    const out = await processImage(await png(400, 300), 'inline')
    expect([out.width, out.height]).toEqual([400, 300])
  })

  it('la portada sale a 1536×1024', async () => {
    const out = await processImage(await png(2000, 2000), 'cover')
    expect([out.width, out.height]).toEqual([1536, 1024])
  })

  it('descarta los metadatos EXIF', async () => {
    const conExif = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#fff' } })
      .withExif({ IFD0: { Copyright: 'privado' } })
      .jpeg()
      .toBuffer()
    expect((await sharp(conExif).metadata()).exif).toBeDefined()
    const out = await processImage(conExif, 'inline')
    expect((await sharp(out.webp).metadata()).exif).toBeUndefined()
  })

  it('la misma imagen da el mismo nombre', async () => {
    const a = await processImage(await png(300, 300), 'inline')
    const b = await processImage(await png(300, 300), 'inline')
    expect(a.hash).toBe(b.hash)
  })

  it('rechaza SVG, GIF y texto aunque se disfracen de imagen', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).gif().toBuffer()
    await expect(processImage(svg, 'inline')).rejects.toBeInstanceOf(ImageError)
    await expect(processImage(gif, 'inline')).rejects.toMatchObject({ code: 'unsupported_format' })
    await expect(processImage(Buffer.from('hola'), 'inline')).rejects.toBeInstanceOf(ImageError)
    await expect(processImage(Buffer.alloc(0), 'inline')).rejects.toMatchObject({ code: 'invalid_image' })
  })

  it('rechaza archivos de más de 10 MB', async () => {
    await expect(processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'inline')).rejects.toMatchObject({ code: 'too_large' })
  })
})

describe('storagePath', () => {
  it('separa portadas e imágenes del texto', () => {
    expect(storagePath('cover', 'abc')).toBe('covers/abc.webp')
    expect(storagePath('inline', 'abc', new Date('2026-10-30T12:00:00Z'))).toBe('inline/2026/abc.webp')
  })
})
