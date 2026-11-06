import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Llamada {
  tabla: string
  metodo: string
  args: unknown[]
}
let llamadas: Llamada[] = []
let respuestas: Record<string, { data: unknown; error: unknown }> = {}

function constructor(tabla: string) {
  let primero = ''
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, metodo: string) {
        if (metodo === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(respuestas[`${tabla}:${primero}`] ?? { data: null, error: null }).then(ok)
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

vi.mock('@/lib/auth', () => ({ requireEditor: async () => ({ user: { email: 'moises@x.com' } }) }))
vi.mock('@/lib/cache', () => ({ revalidatePosts: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createEditorClient: async () => ({ from: (t: string) => constructor(t) }) }))

const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const get = async (qs: string) => {
  const { GET } = await import('./route')
  const res = await GET(new Request('http://localhost/api/posts/historial?' + qs))
  return { res, json: await res.json() }
}
const post = async (body: unknown) => {
  const { POST } = await import('./route')
  const res = await POST(new Request('http://localhost/api/posts/historial', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }))
  return { res, json: await res.json() }
}
const hizo = (tabla: string, metodo: string) => llamadas.some((l) => l.tabla === tabla && l.metodo === metodo)

describe('GET /api/posts/historial', () => {
  beforeEach(() => {
    vi.resetModules()
    llamadas = []
    respuestas = {}
  })

  it('lista las versiones con un resumen corto del texto (no el HTML completo)', async () => {
    respuestas['posts_historial:select'] = {
      data: [{ id: 7, created_at: '2026-11-06T10:00:00Z', editado_por: 'moises@x.com', motivo: 'edicion', title: 'Ueno Bank', content_html: '<p>Hola <b>mundo</b></p>' }],
      error: null,
    }
    const { res, json } = await get(`id=${ID}&locale=es`)
    expect(res.status).toBe(200)
    expect(json.data).toEqual([{ id: 7, created_at: '2026-11-06T10:00:00Z', editado_por: 'moises@x.com', motivo: 'edicion', title: 'Ueno Bank', resumen: 'Hola mundo' }])
  })

  it('rechaza parámetros inválidos', async () => {
    expect((await get('id=no-uuid&locale=es')).res.status).toBe(400)
    expect((await get(`id=${ID}&locale=fr`)).res.status).toBe(400)
  })

  it('si la tabla no existe (migración sin aplicar) responde 500 con lista vacía, sin romper la pantalla', async () => {
    respuestas['posts_historial:select'] = { data: null, error: { message: 'relation does not exist' } }
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, json } = await get(`id=${ID}&locale=es`)
    expect(res.status).toBe(500)
    expect(json.data).toEqual([])
    consola.mockRestore()
  })
})

describe('POST /api/posts/historial (restaurar)', () => {
  const version = { id: 7, post_id: ID, locale: 'es', title: 'Ueno Bank original', content_html: '<p>Texto original</p>', meta_title: null, meta_description: null }
  beforeEach(() => {
    vi.resetModules()
    llamadas = []
    respuestas = {
      'posts_historial:select': { data: version, error: null },
      'posts_translations:select': { data: { title: 'Ueno Bank roto', content_html: '<p>Texto estropeado por error</p>', meta_title: null, meta_description: null }, error: null },
      'posts_translations:update': { data: { updated_at: '2026-11-06T11:00:00Z' }, error: null },
    }
  })

  it('restaura la versión, guarda antes la actual (así restaurar también se deshace) y devuelve la nueva fecha', async () => {
    const { res, json } = await post({ id: ID, version_id: 7 })
    expect(res.status).toBe(200)
    expect(json.data).toEqual({ locale: 'es', translation_updated_at: '2026-11-06T11:00:00Z' })
    const guardada = llamadas.find((l) => l.tabla === 'posts_historial' && l.metodo === 'insert')!
    expect(guardada.args[0]).toMatchObject({ title: 'Ueno Bank roto', motivo: 'restauracion', editado_por: 'moises@x.com' })
    const cambio = llamadas.find((l) => l.tabla === 'posts_translations' && l.metodo === 'update')!
    expect(cambio.args[0]).toEqual({ title: 'Ueno Bank original', content_html: '<p>Texto original</p>', meta_title: null, meta_description: null })
  })

  it('una versión que no es de ese artículo (o ya se podó) responde 404 y no cambia nada', async () => {
    respuestas['posts_historial:select'] = { data: null, error: null }
    const { res } = await post({ id: ID, version_id: 999 })
    expect(res.status).toBe(404)
    expect(hizo('posts_translations', 'update')).toBe(false)
  })

  it('si la versión es idéntica al texto actual no llena el historial', async () => {
    respuestas['posts_translations:select'] = { data: { title: version.title, content_html: version.content_html, meta_title: null, meta_description: null }, error: null }
    await post({ id: ID, version_id: 7 })
    expect(hizo('posts_historial', 'insert')).toBe(false)
  })

  it('rechaza cuerpos inválidos', async () => {
    expect((await post({ id: 'no-uuid', version_id: 7 })).res.status).toBe(400)
    expect((await post({ id: ID, version_id: -1 })).res.status).toBe(400)
    expect((await post({})).res.status).toBe(400)
  })
})
