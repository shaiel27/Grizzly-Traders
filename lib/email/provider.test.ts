import { describe, expect, it, vi } from 'vitest'
import { createMockProvider, createResendProvider, getEmailProvider, ProviderError } from './provider'

function respuesta(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function resendWith(handler: (url: string, init: RequestInit) => Response) {
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}))
  const provider = createResendProvider({
    apiKey: 're_secreta',
    from: 'Grizzly Traders <resumen@example.com>',
    replyTo: 'hola@example.com',
    segments: { es: 'seg-es', en: 'seg-en' },
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })
  return { provider, fetchImpl }
}

describe('proveedor simulado', () => {
  it('guarda correos, contactos y difusiones sin enviar nada', async () => {
    const mock = createMockProvider()
    await mock.sendTransactional({ to: 'a@example.com', subject: 'Hola', html: '<p>Hola</p>', text: 'Hola' })
    await mock.upsertContact({ email: 'a@example.com', locale: 'es' })
    await mock.unsubscribeContact('a@example.com')
    const broadcast = await mock.sendBroadcast({ locale: 'es', name: 'n', subject: 's', html: 'h', text: 't' })

    expect(mock.sent).toHaveLength(1)
    expect(mock.contacts.get('a@example.com')).toEqual({ locale: 'es', unsubscribed: true })
    expect(broadcast.id).toBe('mock-broadcast-1')
  })

  it('permite simular fallos del proveedor', async () => {
    const mock = createMockProvider()
    mock.failing.transactional = true
    await expect(mock.sendTransactional({ to: 'a@example.com', subject: 's', html: 'h', text: 't' })).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('adaptador de Resend', () => {
  it('envía correos del sistema con la llave, el remitente y la clave de idempotencia', async () => {
    const { provider, fetchImpl } = resendWith(() => respuesta(200, { id: 'x' }))
    await provider.sendTransactional({ to: 'a@example.com', subject: 'Hola', html: '<p>h</p>', text: 'h', idempotencyKey: 'clave-1' })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toBe('https://api.resend.com/emails')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer re_secreta')
    expect(headers['Idempotency-Key']).toBe('clave-1')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).toMatchObject({ from: 'Grizzly Traders <resumen@example.com>', to: ['a@example.com'], reply_to: 'hola@example.com' })
  })

  it('no filtra la llave en los mensajes de error', async () => {
    const { provider } = resendWith(() => respuesta(401, { message: 'invalid api key' }))
    const error = await provider.sendTransactional({ to: 'a@example.com', subject: 's', html: 'h', text: 't' }).catch((e: Error) => e)
    expect(error).toBeInstanceOf(ProviderError)
    expect((error as Error).message).not.toContain('re_secreta')
    expect((error as ProviderError).status).toBe(401)
  })

  it('crea el contacto en el segmento de su idioma', async () => {
    const { provider, fetchImpl } = resendWith(() => respuesta(200, { id: 'c1' }))
    await provider.upsertContact({ email: 'a@example.com', locale: 'en' })
    const body = JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body))
    expect(body).toEqual({ email: 'a@example.com', unsubscribed: false, segments: [{ id: 'seg-en' }] })
  })

  it('reactiva el contacto si ya existía', async () => {
    const { provider, fetchImpl } = resendWith((url) => (url.endsWith('/contacts') ? respuesta(409) : respuesta(200, { id: 'c1' })))
    await provider.upsertContact({ email: 'a+b@example.com', locale: 'es' })
    expect(String(fetchImpl.mock.calls[1][0])).toBe('https://api.resend.com/contacts/a%2Bb%40example.com')
    expect((fetchImpl.mock.calls[1][1] as RequestInit).method).toBe('PATCH')
  })

  it('la baja de un contacto que no existe no es un error', async () => {
    const { provider } = resendWith(() => respuesta(404))
    await expect(provider.unsubscribeContact('nadie@example.com')).resolves.toBeUndefined()
  })

  it('la baja falla si el proveedor responde con un error de servidor', async () => {
    const { provider } = resendWith(() => respuesta(500))
    await expect(provider.unsubscribeContact('a@example.com')).rejects.toBeInstanceOf(ProviderError)
  })

  it('crea y envía la difusión en una sola llamada con el segmento del idioma', async () => {
    const { provider, fetchImpl } = resendWith(() => respuesta(200, { object: 'broadcast', id: 'b-1' }))
    const result = await provider.sendBroadcast({ locale: 'es', name: 'Resumen 2026-10-27', subject: 'Asunto', html: '<p>h</p>', text: 't' })
    expect(result).toEqual({ id: 'b-1' })
    const body = JSON.parse(String((fetchImpl.mock.calls[0][1] as RequestInit).body))
    expect(body).toMatchObject({ segment_id: 'seg-es', send: true, subject: 'Asunto', name: 'Resumen 2026-10-27' })
  })

  it('no envía una difusión si falta el segmento del idioma', async () => {
    const fetchImpl = vi.fn()
    const provider = createResendProvider({ apiKey: 'k', from: 'f@example.com', segments: { es: 'seg-es' }, fetchImpl: fetchImpl as unknown as typeof fetch })
    await expect(provider.sendBroadcast({ locale: 'en', name: 'n', subject: 's', html: 'h', text: 't' })).rejects.toBeInstanceOf(ProviderError)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('cada petición lleva un tope de tiempo para que un envío colgado no bloquee el día', async () => {
    const { provider, fetchImpl } = resendWith(() => respuesta(200, { id: 'b-1' }))
    await provider.sendBroadcast({ locale: 'es', name: 'n', subject: 's', html: 'h', text: 't' })
    expect((fetchImpl.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })

  const difusion = { locale: 'es' as const, name: 'n', subject: 's', html: 'h', text: 't' }

  it('un rechazo claro (4xx) de la difusión se puede reintentar sin duplicar', async () => {
    const { provider } = resendWith(() => respuesta(422, { message: 'invalid' }))
    await expect(provider.sendBroadcast(difusion)).rejects.toMatchObject({ retrySafe: true, status: 422 })
  })

  it('un 5xx, un 408 o una respuesta sin id dejan la duda: NO se marcan como reintentables', async () => {
    for (const status of [500, 502, 408]) {
      const { provider } = resendWith(() => respuesta(status))
      await expect(provider.sendBroadcast(difusion)).rejects.toMatchObject({ retrySafe: false })
    }
    const { provider } = resendWith(() => respuesta(200, {}))
    await expect(provider.sendBroadcast(difusion)).rejects.toMatchObject({ retrySafe: false })
  })

  it('un corte de red durante la difusión sale como error no reintentable', async () => {
    const provider = createResendProvider({
      apiKey: 'k',
      from: 'f@example.com',
      segments: { es: 'seg-es' },
      fetchImpl: (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch,
    })
    const error = await provider.sendBroadcast(difusion).catch((e: unknown) => e)
    expect(error).not.toBeInstanceOf(ProviderError)
  })

  it('un segmento que falta se detecta antes de enviar y es reintentable', async () => {
    const provider = createResendProvider({ apiKey: 'k', from: 'f@example.com', segments: { es: 'seg-es' }, fetchImpl: vi.fn() as unknown as typeof fetch })
    await expect(provider.sendBroadcast({ ...difusion, locale: 'en' })).rejects.toMatchObject({ retrySafe: true })
  })
})

describe('getEmailProvider', () => {
  it('usa Resend cuando hay llave y remitente', () => {
    expect(getEmailProvider({ RESEND_API_KEY: 're_x', EMAIL_FROM: 'a <a@example.com>' })?.name).toBe('resend')
  })

  it('con llave pero sin remitente deja el boletín desactivado', () => {
    expect(getEmailProvider({ RESEND_API_KEY: 're_x' })).toBeNull()
  })

  it('en producción sin llave no usa el simulado', () => {
    expect(getEmailProvider({ NODE_ENV: 'production' })).toBeNull()
  })

  it('en desarrollo sin llave usa el simulado', () => {
    expect(getEmailProvider({ NODE_ENV: 'development' })?.name).toBe('mock')
  })
})
