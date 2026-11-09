import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Llamada {
  tabla: string
  metodo: string
  args: unknown[]
}
let llamadas: Llamada[] = []
type Resp = { data: unknown; error: unknown }
// Una lista se consume en orden (cada consulta recibe la suya); un objeto se repite
let respuestas: Record<string, Resp | Resp[]> = {}
const siguiente = (clave: string): Resp => {
  const r = respuestas[clave]
  if (Array.isArray(r)) return r.length > 1 ? r.shift()! : r[0]
  return r ?? { data: null, error: null }
}
const quitados: string[][] = []

function constructor(tabla: string) {
  let primero = ''
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, metodo: string) {
        if (metodo === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(siguiente(`${tabla}:${primero}`)).then(ok)
        return (...args: unknown[]) => {
          if (!primero) primero = metodo
          llamadas.push({ tabla, metodo, args })
          return proxy
        }
      },
    }
  )
  return proxy
}

const programar = vi.fn(async () => ({ portada: true, categoria: false, traduccion: false, anuncio: false }))
let configurado = true
vi.mock('@/lib/auth', () => ({ requireEditor: async () => ({ user: { email: 'moises@x.com' } }) }))
vi.mock('@/lib/cache', () => ({ revalidatePosts: vi.fn() }))
vi.mock('@/lib/completar', () => ({ programarCompletado: (...a: unknown[]) => programar(...(a as [])), urlCompletar: () => (configurado ? 'http://n8n/webhook' : null) }))
vi.mock('@/lib/supabase/admin', () => ({
  createEditorClient: async () => ({
    from: (t: string) => constructor(t),
    storage: { from: () => ({ remove: async (n: string[]) => (quitados.push(n), { error: null }) }) },
  }),
}))

const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const URL = 'https://x.supabase.co/storage/v1/object/public/post-images/'
const llamar = async (cuerpo: unknown) => {
  const { POST } = await import('./route')
  const res = await POST(new Request('http://localhost/api/posts/regenerar-portada', { method: 'POST', body: JSON.stringify(cuerpo) }))
  return { res, json: await res.json() }
}

describe('POST /api/posts/regenerar-portada', () => {
  beforeEach(() => {
    vi.resetModules()
    llamadas = []
    quitados.length = 0
    configurado = true
    programar.mockClear()
    respuestas = { 'posts:select': [{ data: { id: ID, status: 'published', cover_image_url: `${URL}a-1.webp`, og_image_url: `${URL}a-1.webp` }, error: null }, { data: [], error: null }] }
  })

  it('quita la portada, borra el archivo anterior y lanza el completado (202)', async () => {
    const { res, json } = await llamar({ id: ID })
    expect(res.status).toBe(202)
    expect(json.data.faltantes.portada).toBe(true)
    const cambio = llamadas.find((l) => l.metodo === 'update')!
    expect(cambio.args[0]).toEqual({ cover_image_url: null, og_image_url: null })
    expect(quitados).toEqual([['a-1.webp']])
    expect(programar).toHaveBeenCalledOnce()
  })

  it('si otro artículo comparte el archivo, no se borra del almacenamiento', async () => {
    respuestas['posts:select'] = [
      { data: { id: ID, status: 'published', cover_image_url: `${URL}a-1.webp`, og_image_url: null }, error: null },
      { data: [{ id: 'otro' }], error: null },
    ]
    const { res } = await llamar({ id: ID })
    expect(res.status).toBe(202)
    expect(quitados).toEqual([])
  })

  it('un borrador no tiene portada que regenerar (409) y no se toca nada', async () => {
    respuestas['posts:select'] = { data: { id: ID, status: 'draft', cover_image_url: null, og_image_url: null }, error: null }
    const { res } = await llamar({ id: ID })
    expect(res.status).toBe(409)
    expect(llamadas.some((l) => l.metodo === 'update')).toBe(false)
  })

  it('sin el flujo editorial configurado responde 503 y no borra nada', async () => {
    configurado = false
    const { res, json } = await llamar({ id: ID })
    expect(res.status).toBe(503)
    expect(json.code).toBe('no_configurado')
    expect(llamadas).toEqual([])
  })

  it('artículo inexistente o id inválido', async () => {
    respuestas['posts:select'] = { data: null, error: null }
    expect((await llamar({ id: ID })).res.status).toBe(404)
    expect((await llamar({ id: 'no-uuid' })).res.status).toBe(400)
  })
})
