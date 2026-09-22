import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}))

import { getEditor, requireEditor } from './auth'

const user = (email: string | undefined) => ({ data: { user: email ? { email } : null } })

describe('getEditor', () => {
  beforeEach(() => {
    getUser.mockReset()
    vi.unstubAllEnvs()
  })

  it('is unauthenticated when there is no session', async () => {
    getUser.mockResolvedValue(user(undefined))
    expect(await getEditor()).toEqual({ status: 'unauthenticated' })
  })

  it('is unauthenticated when the user has no email', async () => {
    getUser.mockResolvedValue({ data: { user: {} } })
    expect(await getEditor()).toEqual({ status: 'unauthenticated' })
  })

  it('matches the allowlist case-insensitively', async () => {
    vi.stubEnv('CMS_ALLOWED_EMAILS', 'grizzlytrader@gmail.com')
    getUser.mockResolvedValue(user('GRIZZLYTrader@Gmail.com'))
    const result = await getEditor()
    expect(result.status).toBe('ok')
  })

  it('is forbidden when the email is not listed', async () => {
    vi.stubEnv('CMS_ALLOWED_EMAILS', 'grizzlytrader@gmail.com')
    getUser.mockResolvedValue(user('someone-else@gmail.com'))
    expect(await getEditor()).toEqual({ status: 'forbidden' })
  })

  it('trims whitespace around each listed email', async () => {
    vi.stubEnv('CMS_ALLOWED_EMAILS', ' a@b.com , c@d.com ')
    getUser.mockResolvedValue(user('a@b.com'))
    const result = await getEditor()
    expect(result.status).toBe('ok')
  })

  it('is forbidden for any email when the allowlist is empty or unset', async () => {
    vi.stubEnv('CMS_ALLOWED_EMAILS', '')
    getUser.mockResolvedValue(user('anyone@example.com'))
    expect(await getEditor()).toEqual({ status: 'forbidden' })
  })
})

describe('requireEditor', () => {
  beforeEach(() => {
    getUser.mockReset()
    vi.unstubAllEnvs()
  })

  it('returns a 401 response when unauthenticated', async () => {
    getUser.mockResolvedValue(user(undefined))
    const result = await requireEditor()
    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(401)
      expect(await result.response.json()).toEqual({ success: false, error: 'No autenticado' })
    }
  })

  it('returns a 403 response when forbidden', async () => {
    vi.stubEnv('CMS_ALLOWED_EMAILS', 'grizzlytrader@gmail.com')
    getUser.mockResolvedValue(user('someone-else@gmail.com'))
    const result = await requireEditor()
    expect('response' in result).toBe(true)
    if ('response' in result) {
      expect(result.response.status).toBe(403)
      expect(await result.response.json()).toEqual({ success: false, error: 'Sin permisos' })
    }
  })

  it('returns the user when allowed', async () => {
    vi.stubEnv('CMS_ALLOWED_EMAILS', 'grizzlytrader@gmail.com')
    getUser.mockResolvedValue(user('grizzlytrader@gmail.com'))
    const result = await requireEditor()
    expect('response' in result).toBe(false)
    if (!('response' in result)) {
      expect(result.user.email).toBe('grizzlytrader@gmail.com')
    }
  })
})
