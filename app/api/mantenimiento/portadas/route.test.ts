import { beforeEach, describe, expect, it, vi } from 'vitest'

const SECRETO = 'x'.repeat(40)
const aplicar = vi.fn()
const huerfanos = vi.fn()
const anotar = vi.fn()
vi.mock('@/lib/cache', () => ({ revalidatePosts: vi.fn() }))
vi.mock('@/lib/newsletter/repo', () => ({ createServiceClient: () => ({}) }))
vi.mock('@/lib/portadas-db', () => ({
  aplicarRetencion: (...a: unknown[]) => aplicar(...a),
  limpiarHuerfanos: (...a: unknown[]) => huerfanos(...a),
  anotarEnLog: (...a: unknown[]) => anotar(...a),
  usoActual: async () => ({ archivos: 700, bytes: 400_000_000, mb: 400, porcentaje: 40, alerta: false }),
}))

const llamar = async (cuerpo: unknown, auth: string | null = `Bearer ${SECRETO}`) => {
  const { POST } = await import('./route')
  return POST(new Request('http://localhost/api/mantenimiento/portadas', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }))
}

describe('POST /api/mantenimiento/portadas', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('PIPELINE_API_SECRET', SECRETO)
    aplicar.mockReset().mockResolvedValue({ articulos: 3, archivos: 3, omitidos: 0, pendientes: 0 })
    huerfanos.mockReset().mockResolvedValue({ archivos: 2, mb: 1, nombres: ['a', 'b'] })
    anotar.mockReset()
  })

  it('sin secreto configurado o sin credencial correcta no hace nada', async () => {
    expect((await llamar({}, null)).status).toBe(401)
    expect((await llamar({}, 'Bearer otro')).status).toBe(401)
    vi.stubEnv('PIPELINE_API_SECRET', '')
    expect((await llamar({})).status).toBe(503)
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('sin cuerpo o sin «ensayo: false» explícito solo informa: no borra ni anota', async () => {
    const res = await llamar(undefined)
    const json = await res.json()
    expect(json.ensayo).toBe(true)
    expect(aplicar.mock.calls[0][1]).toBe(true)
    expect(huerfanos.mock.calls[0][1]).toBe(true)
    expect(anotar).not.toHaveBeenCalled()
  })

  it('con «ensayo: false» borra con la ventana de 18 días y lo deja anotado', async () => {
    const res = await llamar({ ensayo: false })
    const json = await res.json()
    expect(json).toMatchObject({ success: true, ensayo: false, dias: 18, retencion: { articulos: 3 }, huerfanos: { archivos: 2 } })
    expect(aplicar.mock.calls[0].slice(1)).toEqual([false, 18])
    expect(anotar).toHaveBeenCalledOnce()
  })

  it('una ventana absurda (menos de 7 días) se rechaza', async () => {
    expect((await llamar({ ensayo: false, dias: 1 })).status).toBe(400)
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('un fallo no filtra detalles', async () => {
    aplicar.mockRejectedValue(new Error('clave secreta en el mensaje'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await llamar({ ensayo: false })
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secreta')
  })
})
