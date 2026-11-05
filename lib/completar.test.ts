import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/server', () => ({ after: (fn: () => unknown) => void fn() }))

import { calcularFaltantes, completarArticulo, hayFaltantes, urlCompletar } from './completar'

const completo = { cover_image_url: 'https://x/y.webp', category_id: 4, original_locale: 'es', locales: ['es', 'en'] }

describe('calcularFaltantes', () => {
  it('un artículo completo no necesita nada', () => {
    const f = calcularFaltantes(completo)
    expect(f).toEqual({ portada: false, categoria: false, traduccion: false })
    expect(hayFaltantes(f)).toBe(false)
  })

  it('el caso de un artículo escrito a mano: sin portada, sin categoría y sin traducción', () => {
    const f = calcularFaltantes({ cover_image_url: null, category_id: null, original_locale: 'es', locales: ['es'] })
    expect(f).toEqual({ portada: true, categoria: true, traduccion: true })
    expect(hayFaltantes(f)).toBe(true)
  })

  it('una portada vacía cuenta como falta; la categoría 0 no (solo null)', () => {
    expect(calcularFaltantes({ ...completo, cover_image_url: '' }).portada).toBe(true)
    expect(calcularFaltantes({ ...completo, category_id: 0 }).categoria).toBe(false)
  })

  it('la traducción que falta es la del idioma opuesto al original', () => {
    expect(calcularFaltantes({ ...completo, original_locale: 'en', locales: ['en'] }).traduccion).toBe(true)
    expect(calcularFaltantes({ ...completo, original_locale: 'en', locales: ['en', 'es'] }).traduccion).toBe(false)
  })

  it('si el original declarado no existe, se toma el único idioma escrito', () => {
    // original_locale por defecto es "es", pero el editor escribió solo en inglés: falta la versión en español
    expect(calcularFaltantes({ ...completo, original_locale: 'es', locales: ['en'] }).traduccion).toBe(true)
  })

  it('sin ninguna versión escrita no hay qué traducir', () => {
    expect(calcularFaltantes({ ...completo, locales: [] }).traduccion).toBe(false)
  })
})

describe('urlCompletar', () => {
  it('deriva la URL del flujo editorial cambiando su final', () => {
    expect(urlCompletar({ N8N_WEBHOOK_EDITORIAL: 'http://localhost:5678/webhook/cms-editorial' })).toBe('http://localhost:5678/webhook/cms-completar')
  })
  it('permite fijarla aparte y gana a la derivada', () => {
    expect(urlCompletar({ N8N_WEBHOOK_COMPLETAR: 'http://n8n/otra', N8N_WEBHOOK_EDITORIAL: 'http://localhost:5678/webhook/cms-editorial' })).toBe('http://n8n/otra')
  })
  it('sin configuración, o con una URL que no se reconoce, queda desactivada', () => {
    expect(urlCompletar({})).toBeNull()
    expect(urlCompletar({ N8N_WEBHOOK_EDITORIAL: 'http://localhost:5678/webhook/otro-flujo' })).toBeNull()
  })
})

describe('completarArticulo', () => {
  const ID = 'be1f67f1-5e1a-4fa4-ad12-ad727059cca2'
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sin n8n configurado no hace nada', async () => {
    vi.stubEnv('N8N_WEBHOOK_EDITORIAL', '')
    vi.stubEnv('N8N_WEBHOOK_COMPLETAR', '')
    expect(await completarArticulo(ID)).toEqual({ estado: 'no_configurado' })
  })

  it('manda solo el id y quién lo pidió, con el token si hay', async () => {
    vi.stubEnv('N8N_WEBHOOK_COMPLETAR', 'http://n8n/cms-completar')
    vi.stubEnv('N8N_WEBHOOK_EDITORIAL_TOKEN', 'tok')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, pendientes: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await completarArticulo(ID, 'moises@example.com')).toEqual({ estado: 'listo', pendientes: [] })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://n8n/cms-completar')
    expect(JSON.parse(init.body as string)).toEqual({ post_id: ID, solicitado_por: 'moises@example.com' })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('informa lo que quedó pendiente y los fallos de n8n sin lanzar', async () => {
    vi.stubEnv('N8N_WEBHOOK_COMPLETAR', 'http://n8n/cms-completar')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, pendientes: ['portada'], errores: { portada: 'x' } }), { status: 200 })))
    expect(await completarArticulo(ID)).toEqual({ estado: 'listo', pendientes: ['portada'] })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"ok":false,"error":"boom"}', { status: 500 })))
    expect(await completarArticulo(ID)).toEqual({ estado: 'error', motivo: 'boom' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')))
    expect(await completarArticulo(ID)).toEqual({ estado: 'error', motivo: 'ECONNREFUSED' })
  })

  it('no completa el mismo artículo dos veces a la vez', async () => {
    vi.stubEnv('N8N_WEBHOOK_COMPLETAR', 'http://n8n/cms-completar')
    let soltar: (r: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((res) => { soltar = res })))
    const primera = completarArticulo(ID)
    expect(await completarArticulo(ID)).toEqual({ estado: 'en_curso' })
    soltar(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    expect(await primera).toEqual({ estado: 'listo', pendientes: [] })
    // y al terminar, el id queda libre
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })))
    expect((await completarArticulo(ID)).estado).toBe('listo')
  })
})
