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
        if (metodo === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(respuestas[`${tabla}:${primero}`] ?? { data: [], error: null }).then(ok)
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

const completar = vi.fn()
vi.mock('@/lib/auth', () => ({ requireEditor: async () => ({ user: { email: 'moises@x.com' } }) }))
vi.mock('@/lib/cache', () => ({ revalidatePosts: vi.fn() }))
vi.mock('@/lib/completar', () => ({ programarCompletado: (...a: unknown[]) => completar(...a) }))
vi.mock('@/lib/supabase/admin', () => ({ createEditorClient: async () => ({ from: (t: string) => constructor(t) }) }))

const A = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const B = '11111111-1111-4111-8111-111111111111'
const llamar = async (cuerpo: unknown) => {
  const { POST } = await import('./route')
  const res = await POST(new Request('http://localhost/api/posts/lote', { method: 'POST', body: JSON.stringify(cuerpo) }))
  return { res, json: await res.json() }
}
const hizo = (metodo: string) => llamadas.some((l) => l.metodo === metodo)

describe('POST /api/posts/lote', () => {
  beforeEach(() => {
    vi.resetModules()
    llamadas = []
    respuestas = {}
    completar.mockReset()
  })

  it('borrar: cuenta solo los que existían', async () => {
    respuestas['posts:delete'] = { data: [{ id: A }], error: null }
    const { res, json } = await llamar({ accion: 'borrar', ids: [A, B] })
    expect(res.status).toBe(200)
    expect(json.data).toEqual({ accion: 'borrar', pedidos: 2, cambiados: 1 })
  })

  it('despublicar: pasa a borrador solo los que estaban publicados o programados', async () => {
    respuestas['posts:update'] = { data: [{ id: A }, { id: B }], error: null }
    const { json } = await llamar({ accion: 'despublicar', ids: [A, B] })
    expect(json.data.cambiados).toBe(2)
    const cambio = llamadas.find((l) => l.metodo === 'update')!
    expect(cambio.args[0]).toEqual({ status: 'draft' })
    expect(llamadas.some((l) => l.metodo === 'neq' && l.args[1] === 'draft')).toBe(true)
  })

  it('publicar: conserva la fecha original (solo rellena las vacías) y completa lo que falte de cada uno', async () => {
    respuestas['posts:update'] = { data: [{ id: A }], error: null }
    await llamar({ accion: 'publicar', ids: [A, B] })
    expect(llamadas.some((l) => l.metodo === 'is' && l.args[0] === 'published_at' && l.args[1] === null)).toBe(true)
    expect(completar).toHaveBeenCalledTimes(1)
    expect(completar.mock.calls[0][1]).toBe(A)
  })

  it('un lote vacío, con ids inválidos o demasiado grande se rechaza sin tocar la base', async () => {
    for (const malo of [{ accion: 'borrar', ids: [] }, { accion: 'borrar', ids: ['x'] }, { accion: 'otra', ids: [A] }, null]) {
      expect((await llamar(malo)).res.status).toBe(400)
    }
    expect(llamadas).toEqual([])
  })

  it('si la base falla responde 500 sin filtrar detalles', async () => {
    respuestas['posts:delete'] = { data: null, error: { message: 'detalle interno' } }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, json } = await llamar({ accion: 'borrar', ids: [A] })
    expect(res.status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('detalle interno')
    expect(hizo('delete')).toBe(true)
  })
})
