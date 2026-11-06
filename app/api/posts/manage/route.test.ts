import { beforeEach, describe, expect, it, vi } from 'vitest'

// Guardar una edición (PUT): control de cambios simultáneos e historial de versiones.
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
vi.mock('@/lib/completar', () => ({ programarCompletado: async () => null }))
vi.mock('@/lib/supabase/admin', () => ({ createEditorClient: async () => ({ from: (t: string) => constructor(t) }) }))

const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
const FECHA = '2026-11-06T10:00:00.000000+00:00'
const cuerpo = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  title: 'Ueno Bank corregido',
  slug: 'ueno-bank',
  content_html: '<p>Texto corregido por el editor</p>',
  locale: 'es',
  status: 'published',
  asset_ids: [],
  tag_ids: [],
  expected_translation_updated_at: FECHA,
  ...extra,
})
const put = async (body: unknown) => {
  const { PUT } = await import('./route')
  const res = await PUT(new Request('http://localhost/api/posts/manage', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }))
  return { res, json: await res.json() }
}
const hizo = (tabla: string, metodo: string) => llamadas.some((l) => l.tabla === tabla && l.metodo === metodo)
const traduccionActual = (extra: Record<string, unknown> = {}) => ({ data: { title: 'Ueno Bank', content_html: '<p>Texto original</p>', meta_title: null, meta_description: null, updated_at: FECHA, ...extra }, error: null })

describe('PUT /api/posts/manage', () => {
  beforeEach(() => {
    vi.resetModules()
    llamadas = []
    respuestas = {
      'posts:select': { data: { published_at: '2026-11-05T00:00:00Z', cover_image_url: null, category_id: null }, error: null },
      'posts_translations:select': traduccionActual(),
      'posts_translations:upsert': { data: { updated_at: '2026-11-06T10:30:00.000000+00:00' }, error: null },
    }
  })

  it('guarda, conserva la versión anterior (quién y qué) y devuelve la nueva fecha de la traducción', async () => {
    const { res, json } = await put(cuerpo())
    expect(res.status).toBe(200)
    expect(json.data.translation_updated_at).toBe('2026-11-06T10:30:00.000000+00:00')
    const insercion = llamadas.find((l) => l.tabla === 'posts_historial' && l.metodo === 'insert')!
    expect(insercion.args[0]).toMatchObject({ post_id: ID, locale: 'es', title: 'Ueno Bank', content_html: '<p>Texto original</p>', editado_por: 'moises@x.com', motivo: 'edicion' })
    expect(hizo('posts_translations', 'upsert')).toBe(true)
  })

  it('si el texto cambió mientras se editaba (otra persona o el flujo automático), responde 409 y NO escribe nada', async () => {
    respuestas['posts_translations:select'] = traduccionActual({ updated_at: '2026-11-06T10:05:00.000000+00:00' })
    const { res, json } = await put(cuerpo())
    expect(res.status).toBe(409)
    expect(json.code).toBe('conflicto')
    expect(json.translation_updated_at).toBe('2026-11-06T10:05:00.000000+00:00')
    expect(hizo('posts', 'update')).toBe(false)
    expect(hizo('posts_translations', 'upsert')).toBe(false)
    expect(hizo('posts_historial', 'insert')).toBe(false)
  })

  it('guardar sin cambiar el texto no llena el historial', async () => {
    respuestas['posts_translations:select'] = traduccionActual({ title: 'Ueno Bank corregido', content_html: '<p>Texto corregido por el editor</p>' })
    const { res } = await put(cuerpo())
    expect(res.status).toBe(200)
    expect(hizo('posts_historial', 'insert')).toBe(false)
  })

  it('un historial roto (tabla sin crear o error) no impide guardar el trabajo del editor', async () => {
    respuestas['posts_historial:insert'] = { data: null, error: { message: 'relation "posts_historial" does not exist' } }
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res } = await put(cuerpo())
    expect(res.status).toBe(200)
    expect(hizo('posts_translations', 'upsert')).toBe(true)
    consola.mockRestore()
  })

  it('un cliente que no manda la fecha esperada (versión vieja del panel) sigue guardando', async () => {
    const { res } = await put(cuerpo({ expected_translation_updated_at: undefined }))
    expect(res.status).toBe(200)
  })

  it('crear la versión en otro idioma (que aún no existe) no cuenta como conflicto ni como versión anterior', async () => {
    respuestas['posts_translations:select'] = { data: null, error: null }
    const { res } = await put(cuerpo({ locale: 'en' }))
    expect(res.status).toBe(200)
    expect(hizo('posts_historial', 'insert')).toBe(false)
  })

  it('un artículo inexistente responde 404 sin escribir', async () => {
    respuestas['posts:select'] = { data: null, error: null }
    const { res } = await put(cuerpo())
    expect(res.status).toBe(404)
    expect(hizo('posts_translations', 'upsert')).toBe(false)
  })
})
