import { beforeEach, describe, expect, it, vi } from 'vitest'

const revalidatePosts = vi.fn()
const revalidateCatalog = vi.fn()
vi.mock('@/lib/cache', () => ({ revalidatePosts, revalidateCatalog }))

const SECRET = 's'.repeat(40)
const call = async (headers: Record<string, string> = {}, body?: unknown) => {
  const { POST } = await import('./route')
  return POST(new Request('http://localhost/api/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }))
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.resetModules()
    revalidatePosts.mockClear()
    revalidateCatalog.mockClear()
    vi.stubEnv('PIPELINE_API_SECRET', SECRET)
  })

  it('sin secreto configurado está desactivada', async () => {
    vi.stubEnv('PIPELINE_API_SECRET', '')
    expect((await call({ Authorization: `Bearer ${SECRET}` })).status).toBe(503)
    expect(revalidatePosts).not.toHaveBeenCalled()
  })

  it('rechaza una llave ausente o incorrecta', async () => {
    expect((await call()).status).toBe(401)
    expect((await call({ Authorization: 'Bearer incorrecta' })).status).toBe(401)
    expect(revalidatePosts).not.toHaveBeenCalled()
  })

  it('por defecto caduca solo los posts', async () => {
    const res = await call({ Authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(200)
    expect(revalidatePosts).toHaveBeenCalledTimes(1)
    expect(revalidateCatalog).not.toHaveBeenCalled()
  })

  it('acepta catalog y all', async () => {
    await call({ Authorization: `Bearer ${SECRET}` }, { scope: 'catalog' })
    expect(revalidateCatalog).toHaveBeenCalledTimes(1)
    expect(revalidatePosts).not.toHaveBeenCalled()
    await call({ Authorization: `Bearer ${SECRET}` }, { scope: 'all' })
    expect(revalidatePosts).toHaveBeenCalledTimes(1)
    expect(revalidateCatalog).toHaveBeenCalledTimes(2)
  })

  it('rechaza un scope desconocido', async () => {
    expect((await call({ Authorization: `Bearer ${SECRET}` }, { scope: 'todo' })).status).toBe(400)
  })
})
