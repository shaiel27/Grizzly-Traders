import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Llamada {
  tabla: string
  metodo: string
  args: unknown[]
}
let llamadas: Llamada[] = []
let lectura: { data: unknown; error: unknown } = { data: null, error: null }
let escritura: { data: unknown; error: unknown } = { data: [], error: null }
const revalidatePosts = vi.fn()

function constructor(tabla: string) {
  let esLectura = false
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, metodo: string) {
        if (metodo === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(esLectura ? lectura : escritura).then(ok)
        return (...args: unknown[]) => {
          llamadas.push({ tabla, metodo, args })
          if (metodo === 'maybeSingle') esLectura = true
          return proxy
        }
      },
    }
  )
  return proxy
}

vi.mock('@/lib/auth', () => ({ requireEditor: async () => ({ user: { email: 'moises@x.com' } }) }))
vi.mock('@/lib/cache', () => ({ revalidatePosts }))
vi.mock('@/lib/supabase/admin', () => ({ createEditorClient: async () => ({ from: (t: string) => constructor(t) }) }))

const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const llamar = async (cuerpo: unknown) => {
  const { POST } = await import('./route')
  const res = await POST(new Request('http://localhost/api/posts/errores', { method: 'POST', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }))
  return { res, json: await res.json() }
}
const escribio = (metodo: string) => llamadas.some((l) => l.metodo === metodo)

describe('POST /api/posts/errores', () => {
  beforeEach(() => {
    vi.resetModules()
    llamadas = []
    lectura = { data: null, error: null }
    escritura = { data: [], error: null }
    revalidatePosts.mockClear()
  })

  it('rechaza cuerpos inválidos (acción desconocida, id que no es UUID)', async () => {
    expect((await llamar({ accion: 'borrar_todo' })).res.status).toBe(400)
    expect((await llamar({ accion: 'descartar', id: 'no-es-uuid' })).res.status).toBe(400)
    expect((await llamar(null)).res.status).toBe(400)
    expect(escribio('delete')).toBe(false)
  })

  it('descartar borra un resto de error', async () => {
    lectura = { data: { id: ID, origen: 'rss', status: 'draft', slug: 'pendiente-abc', pipeline_error: null }, error: null }
    const { res } = await llamar({ accion: 'descartar', id: ID })
    expect(res.status).toBe(200)
    expect(escribio('delete')).toBe(true)
    expect(revalidatePosts).toHaveBeenCalled()
  })

  it('NUNCA borra ni reintenta un artículo publicado, uno escrito en el CMS o uno normal', async () => {
    for (const fila of [
      { id: ID, origen: 'rss', status: 'published', slug: 'pendiente-abc', pipeline_error: null },
      { id: ID, origen: 'cms', status: 'draft', slug: 'pendiente-abc', pipeline_error: null },
      { id: ID, origen: 'rss', status: 'draft', slug: 'una-nota-normal', pipeline_error: null },
    ]) {
      llamadas = []
      lectura = { data: fila, error: null }
      for (const accion of ['descartar', 'reintentar'] as const) {
        const { res } = await llamar({ accion, id: ID })
        expect(res.status).toBe(409)
      }
      expect(escribio('delete')).toBe(false)
      expect(escribio('update')).toBe(false)
    }
  })

  it('si ya no existe (se limpió solo) responde 404', async () => {
    lectura = { data: null, error: null }
    expect((await llamar({ accion: 'descartar', id: ID })).res.status).toBe(404)
  })

  it('reintentar pone los intentos a cero y limpia el fallo para que el pipeline lo vuelva a procesar', async () => {
    lectura = { data: { id: ID, origen: 'rss', status: 'draft', slug: 'pendiente-abc', pipeline_error: 'error: HTTP 500' }, error: null }
    const { res } = await llamar({ accion: 'reintentar', id: ID })
    expect(res.status).toBe(200)
    expect(llamadas.find((l) => l.metodo === 'update')!.args[0]).toEqual({ pipeline_attempts: 0, pipeline_error: null })
  })

  it('un duplicado no se reintenta, y un rechazo del checklist se corrige editando el texto', async () => {
    lectura = { data: { id: ID, origen: 'rss', status: 'draft', slug: 'duplicado-abc', pipeline_error: 'duplicado: otro' }, error: null }
    const dup = await llamar({ accion: 'reintentar', id: ID })
    expect(dup.res.status).toBe(409)
    expect(dup.json.error).toMatch(/duplicado/i)
    lectura = { data: { id: ID, origen: 'rss', status: 'draft', slug: 'algo', pipeline_error: 'checklist: copia literal' }, error: null }
    const lista = await llamar({ accion: 'reintentar', id: ID })
    expect(lista.res.status).toBe(409)
    expect(escribio('update')).toBe(false)
  })

  it('limpiar_antiguos borra solo restos de error con más de 1 día y dice cuántos', async () => {
    escritura = { data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], error: null }
    const antes = Date.now()
    const { res, json } = await llamar({ accion: 'limpiar_antiguos' })
    expect(res.status).toBe(200)
    expect(json.data.borradas).toBe(3)
    const f = llamadas.filter((l) => l.tabla === 'posts')
    expect(f.some((l) => l.metodo === 'eq' && l.args[0] === 'origen' && l.args[1] === 'rss')).toBe(true)
    expect(f.some((l) => l.metodo === 'eq' && l.args[0] === 'status' && l.args[1] === 'draft')).toBe(true)
    expect(String(f.find((l) => l.metodo === 'or')!.args[0])).toContain('pendiente-')
    const limite = Date.parse(String(f.find((l) => l.metodo === 'lt')!.args[1]))
    expect(antes - limite).toBeGreaterThanOrEqual(1 * 86_400_000 - 5000)
    expect(antes - limite).toBeLessThan(1 * 86_400_000 + 5000)
  })
})
