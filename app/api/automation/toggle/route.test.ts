import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireEditor: async () => ({ user: { email: 'moises@x.com' } }) }))

describe('POST /api/automation/toggle', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('N8N_API_KEY', 'llave-de-prueba')
    vi.stubEnv('N8N_BASE_URL', 'http://127.0.0.1:5678/')
  })
  afterEach(() => vi.unstubAllEnvs())

  const llamar = async (cuerpo: unknown) => {
    const { POST } = await import('./route')
    return POST(new Request('http://localhost/api/automation/toggle', { method: 'POST', body: JSON.stringify(cuerpo) }))
  }

  it('pausa llamando al n8n local, con la llave en la cabecera', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ active: false })))
    vi.stubGlobal('fetch', f)
    const res = await llamar({ active: false })
    expect(await res.json()).toEqual({ success: true, active: false })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:5678/api/v1/workflows/xvENLqv9HYCbOVcj/deactivate')
    expect((init.headers as Record<string, string>)['X-N8N-API-KEY']).toBe('llave-de-prueba')
  })

  it('reanuda con /activate', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ active: true })))
    vi.stubGlobal('fetch', f)
    await llamar({ active: true })
    expect((f.mock.calls[0] as unknown as [string])[0]).toMatch(/\/activate$/)
  })

  it('si n8n rechaza (llave mala) responde 502 sin filtrar detalles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 401 })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await llamar({ active: true })
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('llave')
  })

  it('sin llave configurada responde 503 y no llama a n8n', async () => {
    vi.stubEnv('N8N_API_KEY', '')
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect((await llamar({ active: true })).status).toBe(503)
    expect(f).not.toHaveBeenCalled()
  })
})
