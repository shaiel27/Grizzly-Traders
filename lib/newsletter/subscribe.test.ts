import { beforeEach, describe, expect, it } from 'vitest'
import { createMockProvider, type MockEmailProvider } from '@/lib/email/provider'
import {
  confirmSubscription,
  confirmUnsubscribe,
  requestSubscription,
  requestUnsubscribe,
  type NewsletterDeps,
  type SubscriberPatch,
  type SubscriberRecord,
  type SubscriberRepo,
} from './subscribe'
import { RESEND_COOLDOWN_MS, TOKEN_TTL_MS } from './tokens'

// Repositorio en memoria con las mismas reglas que la tabla: correo único
function memoryRepo() {
  const rows: SubscriberRecord[] = []
  const repo: SubscriberRepo = {
    async findByEmail(email) {
      return rows.find((row) => row.email === email) ?? null
    },
    async findByTokenHash(hash) {
      return rows.find((row) => row.token_hash === hash) ?? null
    },
    async insert(row) {
      if (rows.some((existing) => existing.email === row.email)) return 'duplicate'
      rows.push({ id: `id-${rows.length + 1}`, ...row })
      return 'inserted'
    },
    async update(id, patch: SubscriberPatch) {
      const row = rows.find((existing) => existing.id === id)
      if (!row) throw new Error('no existe')
      Object.assign(row, patch)
    },
  }
  return { repo, rows }
}

const input = { email: 'Persona@Example.com ', consent: true, locale: 'es' as const, consentText: 'Acepto recibir el resumen diario.' }

let current: Date
let provider: MockEmailProvider
let rows: SubscriberRecord[]
let deps: NewsletterDeps
let counter: number

beforeEach(() => {
  current = new Date('2026-10-27T12:00:00Z')
  provider = createMockProvider()
  const memory = memoryRepo()
  rows = memory.rows
  counter = 0
  deps = {
    repo: memory.repo,
    provider,
    siteUrl: 'https://grizzlytraders.example/',
    postalAddress: 'Calle 1, Miami, FL',
    ipSalt: 'sal',
    now: () => current,
    newToken: () => `token-${++counter}`,
  }
})

function tokenFromEmail(index = provider.sent.length - 1): string {
  const match = provider.sent[index].text.match(/token=([\w-]+)/)
  if (!match) throw new Error('el correo no trae un token')
  return match[1]
}

describe('requestSubscription', () => {
  it('guarda al suscriptor como pendiente, con su consentimiento, y envía la confirmación', async () => {
    const result = await requestSubscription({ ...input, sourceUrl: 'https://grizzlytraders.example/', ip: '203.0.113.7' }, deps)
    expect(result).toEqual({ ok: true })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      email: 'persona@example.com',
      status: 'pending',
      locale: 'es',
      consent_text: 'Acepto recibir el resumen diario.',
      consented_at: current.toISOString(),
      token_purpose: 'confirm',
    })
    expect(rows[0].ip_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0].ip_hash).not.toContain('203.0.113.7')
    // El token se guarda solo como hash
    expect(rows[0].token_hash).not.toContain('token-1')

    expect(provider.sent).toHaveLength(1)
    expect(provider.sent[0].to).toBe('persona@example.com')
    expect(provider.sent[0].html).toContain('https://grizzlytraders.example/newsletter/confirmar?token=token-1')
    // Todavía no es un contacto del proveedor: eso ocurre al confirmar
    expect(provider.contacts.size).toBe(0)
  })

  it('exige consentimiento y un correo válido', async () => {
    expect(await requestSubscription({ ...input, consent: false }, deps)).toEqual({ ok: false, code: 'consent_required' })
    expect(await requestSubscription({ ...input, email: 'no-es-un-correo' }, deps)).toEqual({ ok: false, code: 'invalid_email' })
    expect(rows).toHaveLength(0)
    expect(provider.sent).toHaveLength(0)
  })

  it('no guarda la IP si no hay sal configurada', async () => {
    await requestSubscription({ ...input, ip: '203.0.113.7' }, { ...deps, ipSalt: undefined })
    expect(rows[0].ip_hash).toBeNull()
  })

  it('un correo ya confirmado recibe la misma respuesta y, dentro de la espera, no se le escribe', async () => {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    provider.sent.length = 0

    expect(await requestSubscription(input, deps)).toEqual({ ok: true })
    expect(provider.sent).toHaveLength(0)
    expect(rows).toHaveLength(1)
  })

  it('quien se dio de baja desde el enlace de Resend puede volver a suscribirse y se le reactiva el contacto', async () => {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    const original = { consented_at: rows[0].consented_at, consent_text: rows[0].consent_text }
    // La baja la hizo Resend con su enlace y Supabase no se enteró: sigue "confirmed"
    provider.contacts.set('persona@example.com', { locale: 'es', unsubscribed: true })
    provider.sent.length = 0

    current = new Date(current.getTime() + RESEND_COOLDOWN_MS + 1000)
    expect(await requestSubscription({ ...input, consentText: 'otro texto', ip: '198.51.100.9' }, deps)).toEqual({ ok: true })
    // Recibe el enlace, y su estado y su registro de consentimiento no cambian
    expect(provider.sent).toHaveLength(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('confirmed')
    expect(rows[0]).toMatchObject(original)

    const raw = tokenFromEmail()
    expect(await confirmSubscription(raw, deps)).toBe('confirmed')
    expect(provider.contacts.get('persona@example.com')?.unsubscribed).toBe(false)
    // Pulsar el mismo enlace otra vez no vuelve a hacer nada
    expect(await confirmSubscription(raw, deps)).toBe('already')
  })

  it('el enlace de re-suscripción de un confirmado respeta la espera de 60 s', async () => {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    current = new Date(current.getTime() + RESEND_COOLDOWN_MS + 1000)
    await requestSubscription(input, deps)
    const sent = provider.sent.length
    expect(await requestSubscription(input, deps)).toEqual({ ok: true })
    expect(provider.sent).toHaveLength(sent)
  })

  it('un segundo intento seguido no reenvía el correo ni crea otra fila', async () => {
    await requestSubscription(input, deps)
    expect(await requestSubscription(input, deps)).toEqual({ ok: true })
    expect(rows).toHaveLength(1)
    expect(provider.sent).toHaveLength(1)
  })

  it('pasada la espera, reenvía la confirmación con un token nuevo', async () => {
    await requestSubscription(input, deps)
    current = new Date(current.getTime() + RESEND_COOLDOWN_MS + 1000)
    await requestSubscription(input, deps)
    expect(provider.sent).toHaveLength(2)
    expect(rows).toHaveLength(1)
    expect(tokenFromEmail(0)).not.toBe(tokenFromEmail(1))
  })

  it('quien se dio de baja y vuelve a suscribirse debe confirmar otra vez', async () => {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    await requestUnsubscribe(input.email, 'es', deps)
    await confirmUnsubscribe(tokenFromEmail(), deps)
    expect(rows[0].status).toBe('unsubscribed')

    current = new Date(current.getTime() + RESEND_COOLDOWN_MS + 1000)
    await requestSubscription(input, deps)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].unsubscribed_at).toBeNull()
    expect(provider.contacts.get('persona@example.com')?.unsubscribed).toBe(true)
  })

  it('informa del fallo si el proveedor no puede enviar el correo', async () => {
    provider.failing.transactional = true
    expect(await requestSubscription(input, deps)).toEqual({ ok: false, code: 'failed' })
  })

  it('tras un fallo de envío, reintentar enseguida sí envía el correo (la espera no queda corriendo)', async () => {
    provider.failing.transactional = true
    expect(await requestSubscription(input, deps)).toEqual({ ok: false, code: 'failed' })
    expect(rows[0].token_sent_at).toBeNull()

    provider.failing.transactional = false
    expect(await requestSubscription(input, deps)).toEqual({ ok: true })
    expect(provider.sent).toHaveLength(1)
    expect(tokenFromEmail()).toBe('token-2')
  })
})

describe('confirmSubscription', () => {
  it('confirma, y solo entonces crea el contacto en el proveedor', async () => {
    await requestSubscription(input, deps)
    expect(await confirmSubscription(tokenFromEmail(), deps)).toBe('confirmed')
    expect(rows[0]).toMatchObject({ status: 'confirmed', confirmed_at: current.toISOString() })
    expect(provider.contacts.get('persona@example.com')).toEqual({ locale: 'es', unsubscribed: false })
  })

  it('pulsar el enlace dos veces no duplica nada', async () => {
    await requestSubscription(input, deps)
    const raw = tokenFromEmail()
    await confirmSubscription(raw, deps)
    expect(await confirmSubscription(raw, deps)).toBe('already')
  })

  it('rechaza tokens inventados o vacíos', async () => {
    await requestSubscription(input, deps)
    expect(await confirmSubscription('inventado', deps)).toBe('invalid')
    expect(await confirmSubscription('', deps)).toBe('invalid')
  })

  it('rechaza el enlace vencido', async () => {
    await requestSubscription(input, deps)
    const raw = tokenFromEmail()
    current = new Date(current.getTime() + TOKEN_TTL_MS + 1000)
    expect(await confirmSubscription(raw, deps)).toBe('expired')
    expect(rows[0].status).toBe('pending')
  })

  it('un enlace de baja no sirve para confirmar el alta', async () => {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    await requestUnsubscribe(input.email, 'es', deps)
    expect(await confirmSubscription(tokenFromEmail(), deps)).toBe('invalid')
  })

  it('si el proveedor falla, el enlace sigue vigente para reintentar', async () => {
    await requestSubscription(input, deps)
    const raw = tokenFromEmail()
    provider.failing.contacts = true
    expect(await confirmSubscription(raw, deps)).toBe('failed')
    expect(rows[0].status).toBe('pending')

    provider.failing.contacts = false
    expect(await confirmSubscription(raw, deps)).toBe('confirmed')
  })

  it('un enlace de confirmación viejo no reactiva a quien se dio de baja', async () => {
    await requestSubscription(input, deps)
    const confirmToken = tokenFromEmail()
    await confirmSubscription(confirmToken, deps)
    rows[0].status = 'unsubscribed'
    rows[0].token_purpose = 'confirm'
    expect(await confirmSubscription(confirmToken, deps)).toBe('invalid')
  })
})

describe('baja', () => {
  async function subscribed() {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    provider.sent.length = 0
    current = new Date(current.getTime() + RESEND_COOLDOWN_MS + 1000)
  }

  it('envía el enlace de baja al propio suscriptor y la confirma con ese enlace', async () => {
    await subscribed()
    expect(await requestUnsubscribe('persona@example.com', 'es', deps)).toEqual({ ok: true })
    expect(provider.sent).toHaveLength(1)
    expect(provider.sent[0].html).toContain('/newsletter/baja?token=')

    expect(await confirmUnsubscribe(tokenFromEmail(), deps)).toBe('unsubscribed')
    expect(rows[0]).toMatchObject({ status: 'unsubscribed' })
    expect(rows[0].unsubscribed_at).not.toBeNull()
    expect(provider.contacts.get('persona@example.com')?.unsubscribed).toBe(true)
  })

  it('pedir la baja de una dirección que no existe responde igual y no envía nada', async () => {
    expect(await requestUnsubscribe('nadie@example.com', 'es', deps)).toEqual({ ok: true })
    expect(provider.sent).toHaveLength(0)
  })

  it('valida el correo de la solicitud', async () => {
    expect(await requestUnsubscribe('x', 'es', deps)).toEqual({ ok: false, code: 'invalid_email' })
  })

  it('un token de alta no sirve para darse de baja', async () => {
    await requestSubscription(input, deps)
    expect(await confirmUnsubscribe(tokenFromEmail(), deps)).toBe('invalid')
  })

  it('el enlace de baja vence', async () => {
    await subscribed()
    await requestUnsubscribe('persona@example.com', 'es', deps)
    const raw = tokenFromEmail()
    current = new Date(current.getTime() + TOKEN_TTL_MS + 1000)
    expect(await confirmUnsubscribe(raw, deps)).toBe('expired')
    expect(rows[0].status).toBe('confirmed')
  })

  it('repetir la baja devuelve "already"', async () => {
    await subscribed()
    await requestUnsubscribe('persona@example.com', 'es', deps)
    const raw = tokenFromEmail()
    await confirmUnsubscribe(raw, deps)
    expect(await confirmUnsubscribe(raw, deps)).toBe('already')
  })

  it('tras un fallo al enviar el enlace de baja, reintentar enseguida sí lo envía', async () => {
    await requestSubscription(input, deps)
    await confirmSubscription(tokenFromEmail(), deps)
    provider.sent.length = 0

    provider.failing.transactional = true
    expect(await requestUnsubscribe(input.email, 'es', deps)).toEqual({ ok: false, code: 'failed' })
    provider.failing.transactional = false
    expect(await requestUnsubscribe(input.email, 'es', deps)).toEqual({ ok: true })
    expect(provider.sent).toHaveLength(1)
  })

  it('si el proveedor falla la baja no se marca como hecha', async () => {
    await subscribed()
    await requestUnsubscribe('persona@example.com', 'es', deps)
    const raw = tokenFromEmail()
    provider.failing.contacts = true
    expect(await confirmUnsubscribe(raw, deps)).toBe('failed')
    expect(rows[0].status).toBe('confirmed')
  })
})
