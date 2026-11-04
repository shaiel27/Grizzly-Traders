import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BASE = 'https://proj.supabase.co'
const OWN = `${BASE}/storage/v1/object/public/post-images/portada-ab12cd34.webp`

async function get(u: string) {
  const { GET } = await import('./route')
  return GET(new Request(`http://localhost/api/cover/jpeg?u=${encodeURIComponent(u)}`))
}

describe('GET /api/cover/jpeg', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', BASE)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('convierte una portada del bucket a JPEG y la cachea un año', async () => {
    const webp = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#336699' } }).webp().toBuffer()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(webp), { status: 200 })))
    const res = await get(OWN)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toContain('immutable')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect([meta.format, meta.width]).toEqual(['jpeg', 1280])
  })

  it('no es un proxy abierto: rechaza cualquier URL que no sea del bucket propio', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const u of ['', 'https://evil.example/a.png', 'http://localhost:5678/admin', `${BASE}/storage/v1/object/public/otro/a.png`, `${BASE}/storage/v1/object/public/post-images/../x.png`]) {
      expect((await get(u)).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('una portada que no existe da 404 y un fallo del origen 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })))
    expect((await get(OWN)).status).toBe(404)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red') }))
    expect((await get(OWN)).status).toBe(502)
  })

  it('un archivo que no es una imagen da 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no soy una imagen', { status: 200 })))
    expect((await get(OWN)).status).toBe(502)
  })
})
