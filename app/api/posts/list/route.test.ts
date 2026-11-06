import { beforeEach, describe, expect, it, vi } from 'vitest'

// Constructor de consultas falso: registra cada llamada encadenada y devuelve el resultado preparado al hacer await.
interface Llamada {
  metodo: string
  args: unknown[]
}
let consultas: { tabla: string; opciones: unknown; llamadas: Llamada[] }[] = []
let resultado = { data: [] as unknown[], count: 0, error: null as unknown }

function constructor(tabla: string, opciones: unknown) {
  const registro = { tabla, opciones, llamadas: [] as Llamada[] }
  consultas.push(registro)
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, metodo: string) {
        if (metodo === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok)
        return (...args: unknown[]) => {
          registro.llamadas.push({ metodo, args })
          return proxy
        }
      },
    }
  )
  return proxy
}

vi.mock('@/lib/auth', () => ({ requireEditor: async () => ({ user: { email: 'moises@x.com' } }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createEditorClient: async () => ({ from: (t: string) => ({ select: (_c: string, o: unknown) => constructor(t, o) }) }),
}))

const llamar = async (qs = '') => {
  const { GET } = await import('./route')
  const res = await GET(new Request('http://localhost/api/posts/list' + (qs ? '?' + qs : '')))
  return { res, cuerpo: await res.json() }
}
const principal = () => consultas.find((c) => (c.opciones as { head?: boolean }).head !== true)!
const filtros = (c: { llamadas: Llamada[] }) => c.llamadas.filter((l) => l.metodo !== 'order' && l.metodo !== 'range')

describe('GET /api/posts/list', () => {
  beforeEach(() => {
    vi.resetModules()
    consultas = []
    resultado = { data: [], count: 0, error: null }
  })

  it('por defecto lista «mis artículos»: solo lo escrito en el CMS', async () => {
    await llamar()
    expect(filtros(principal())).toEqual([{ metodo: 'eq', args: ['origen', 'cms'] }])
  })

  it('«automáticos»: origen rss sin los restos de error', async () => {
    await llamar('ambito=auto')
    const f = filtros(principal())
    expect(f[0]).toEqual({ metodo: 'eq', args: ['origen', 'rss'] })
    expect(String(f[1].args[0])).toContain('status.neq.draft')
    expect(String(f[1].args[0])).toContain('slug.not.like.pendiente-*')
  })

  it('«errores»: solo borradores del pipeline con slug de reserva/duplicado o con un fallo guardado', async () => {
    await llamar('ambito=errores')
    const f = filtros(principal())
    expect(f).toContainEqual({ metodo: 'eq', args: ['origen', 'rss'] })
    expect(f).toContainEqual({ metodo: 'eq', args: ['status', 'draft'] })
    const o = f.find((x) => x.metodo === 'or')!
    expect(String(o.args[0])).toContain('slug.like.pendiente-*')
    expect(String(o.args[0])).toContain('slug.like.duplicado-*')
    expect(String(o.args[0])).toContain('pipeline_error.not.is.null')
  })

  it('aplica estado, categoría, fuente y búsqueda; la búsqueda va como parámetro de ilike, sin comodines propios', async () => {
    await llamar('ambito=auto&estado=published&categoria=4&fuente=15&q=Banco%20%25%20Central')
    const f = filtros(principal())
    expect(f).toContainEqual({ metodo: 'eq', args: ['status', 'published'] })
    expect(f).toContainEqual({ metodo: 'eq', args: ['category_id', 4] })
    expect(f).toContainEqual({ metodo: 'eq', args: ['source_id', 15] })
    expect(f).toContainEqual({ metodo: 'ilike', args: ['title', '%Banco Central%'] })
  })

  it('pagina de 25 en 25 en el servidor y ordena por fecha', async () => {
    await llamar('pagina=3')
    const l = principal().llamadas
    expect(l).toContainEqual({ metodo: 'range', args: [50, 74] })
    expect(l).toContainEqual({ metodo: 'order', args: ['created_at', { ascending: false }] })
  })

  it('devuelve los tres contadores (sin filtros) aunque se esté viendo otro ámbito', async () => {
    await llamar('ambito=auto&q=oro')
    const contadores = consultas.filter((c) => (c.opciones as { head?: boolean }).head === true)
    expect(contadores).toHaveLength(3)
    for (const c of contadores) expect(c.llamadas.some((l) => l.metodo === 'ilike')).toBe(false)
  })

  it('muestra qué le falta a cada artículo y el tipo de error en el ámbito de errores', async () => {
    resultado = {
      data: [{ id: 'a', title: 'T', slug: 'duplicado-x', status: 'draft', origen: 'rss', sentiment: 'neutral', view_count: 0, published_at: null, created_at: '2026-11-06', cover_image_url: null, category_id: null, original_locale: 'es', translations: [{ locale: 'es', slug: 's' }], pipeline_error: 'duplicado: otro', pipeline_attempts: 2 }],
      count: 1,
      error: null,
    }
    const { cuerpo } = await llamar('ambito=errores')
    expect(cuerpo.data[0]).toMatchObject({ tipo_error: 'duplicado', faltantes: { portada: true, categoria: true, traduccion: true } })
    expect(cuerpo.total).toBe(1)
  })

  it('un error de la base devuelve 500 con la forma esperada en vez de romper la pantalla', async () => {
    resultado = { data: null as never, count: 0, error: new Error('boom') }
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res, cuerpo } = await llamar()
    expect(res.status).toBe(500)
    expect(cuerpo).toMatchObject({ success: false, data: [], total: 0, conteos: { mis: 0, auto: 0, errores: 0 } })
    consola.mockRestore()
  })
})
