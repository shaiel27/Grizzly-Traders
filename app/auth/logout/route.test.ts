import { beforeEach, describe, expect, it, vi } from 'vitest'

const signOut = vi.fn()
const set = vi.fn()
let cookiesEnLaPeticion: { name: string; value: string }[] = []

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signOut } }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => cookiesEnLaPeticion, set }) }))

const llamar = async (headers: Record<string, string> = {}, metodo = 'POST') => {
  const ruta = await import('./route')
  const handler = (ruta as Record<string, unknown>)[metodo] as ((r: Request) => Promise<Response>) | undefined
  return handler ? handler(new Request('http://127.0.0.1:3000/auth/logout', { method: metodo, headers })) : undefined
}

describe('POST /auth/logout', () => {
  beforeEach(() => {
    vi.resetModules()
    signOut.mockReset().mockResolvedValue({ error: null })
    set.mockClear()
    cookiesEnLaPeticion = [
      { name: 'sb-abc-auth-token.0', value: 'x' },
      { name: 'sb-abc-auth-token.1', value: 'y' },
      { name: 'gt_locale', value: 'es' },
    ]
  })

  it('revoca la sesión en el servidor (solo la de este dispositivo) y expira las cookies sb-*, también las partidas en trozos', async () => {
    const res = await llamar({ host: 'grizzlytraders.com', origin: 'https://grizzlytraders.com' })
    expect(res!.status).toBe(200)
    expect(await res!.json()).toEqual({ success: true })
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    const expiradas = set.mock.calls.map((c) => c[0])
    expect(expiradas).toEqual(['sb-abc-auth-token.0', 'sb-abc-auth-token.1'])
    for (const [, valor, opciones] of set.mock.calls) {
      expect(valor).toBe('')
      expect(opciones).toMatchObject({ maxAge: 0, path: '/', httpOnly: true })
    }
  })

  it('no toca las cookies que no son de sesión (el idioma)', async () => {
    await llamar({ host: 'grizzlytraders.com' })
    expect(set.mock.calls.map((c) => c[0])).not.toContain('gt_locale')
  })

  it('detrás de Caddy compara con X-Forwarded-Host, no con la URL interna', async () => {
    const res = await llamar({ 'x-forwarded-host': 'grizzlytraders.com', host: '127.0.0.1:3000', origin: 'https://grizzlytraders.com' })
    expect(res!.status).toBe(200)
  })

  it('rechaza peticiones de otro sitio (no se puede cerrar la sesión del editor desde una página ajena)', async () => {
    const otroOrigen = await llamar({ host: 'grizzlytraders.com', origin: 'https://malo.example' })
    expect(otroOrigen!.status).toBe(403)
    const otroSitio = await llamar({ host: 'grizzlytraders.com', 'sec-fetch-site': 'cross-site' })
    expect(otroSitio!.status).toBe(403)
    const ilegible = await llamar({ host: 'grizzlytraders.com', origin: 'no es una url' })
    expect(ilegible!.status).toBe(403)
    expect(signOut).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })

  it('si Supabase falla al revocar, las cookies se borran igualmente y el editor queda fuera', async () => {
    signOut.mockResolvedValue({ error: { message: 'red caída' } })
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await llamar({ host: 'grizzlytraders.com' })
    expect(res!.status).toBe(200)
    expect(set).toHaveBeenCalledTimes(2)
    consola.mockRestore()
  })

  it('solo acepta POST: un enlace (GET) no puede cerrar la sesión', async () => {
    expect(await llamar({}, 'GET')).toBeUndefined()
  })

  it('la respuesta no se guarda en caché', async () => {
    const res = await llamar({ host: 'grizzlytraders.com' })
    expect(res!.headers.get('cache-control')).toBe('no-store')
  })
})
