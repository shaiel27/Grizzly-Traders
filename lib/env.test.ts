import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
}

describe('parseEnv', () => {
  it('accepts the minimal required configuration', () => {
    expect(parseEnv(valid).ok).toBe(true)
  })

  it('reports every missing required variable', () => {
    const result = parseEnv({})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.join('\n')).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(result.issues.join('\n')).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
  })

  it('treats empty strings from .env files as unset', () => {
    const result = parseEnv({ ...valid, SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_VIP_URL: '  ', CMS_ALLOWED_EMAILS: '' })
    expect(result.ok).toBe(true)
  })

  it('rejects an empty required variable', () => {
    expect(parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: '' }).ok).toBe(false)
  })

  it('rejects malformed URLs', () => {
    const result = parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: 'not a url' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]).toContain('NEXT_PUBLIC_SITE_URL')
  })

  it('validates the editor allowlist as comma-separated emails', () => {
    expect(parseEnv({ ...valid, CMS_ALLOWED_EMAILS: 'a@example.com, b@example.com' }).ok).toBe(true)
    expect(parseEnv({ ...valid, CMS_ALLOWED_EMAILS: 'a@example.com, nope' }).ok).toBe(false)
  })

  it('acepta la configuración opcional del boletín', () => {
    const result = parseEnv({
      ...valid,
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'Grizzly Traders <resumen@example.com>',
      EMAIL_REPLY_TO: 'hola@example.com',
      RESEND_SEGMENT_ES: 'seg-es',
      RESEND_SEGMENT_EN: 'seg-en',
      DIGEST_CRON_SECRET: 'x'.repeat(32),
    })
    expect(result.ok).toBe(true)
  })

  it('rechaza un secreto de cron demasiado corto', () => {
    const result = parseEnv({ ...valid, DIGEST_CRON_SECRET: 'corto' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]).toContain('DIGEST_CRON_SECRET')
  })
})
