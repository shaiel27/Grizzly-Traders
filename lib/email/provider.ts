import type { Locale } from '@/lib/i18n/get-dictionary'

// Capa mínima sobre el proveedor de correo. La lista de suscriptores vive en Supabase; el proveedor
// solo recibe contactos ya confirmados, así que cambiar de proveedor (p. ej. a Kit) es escribir otro
// adaptador de esta interfaz, sin tocar el alta, la confirmación ni la baja.

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  // Evita duplicados si la petición se reintenta (el proveedor la recuerda 24 h)
  idempotencyKey?: string
}

export interface BroadcastInput {
  locale: Locale
  name: string
  subject: string
  html: string
  text: string
}

export interface EmailProvider {
  readonly name: 'resend' | 'mock'
  // Correos del sistema: confirmación de alta y de baja
  sendTransactional(message: EmailMessage): Promise<void>
  // Añade (o reactiva) un contacto confirmado en la audiencia de su idioma
  upsertContact(input: { email: string; locale: Locale }): Promise<void>
  unsubscribeContact(email: string): Promise<void>
  // Envía el resumen a toda la audiencia del idioma y devuelve el id de la difusión
  sendBroadcast(input: BroadcastInput): Promise<{ id: string }>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    // true solo cuando se sabe que el proveedor NO procesó la petición (rechazo claro, 4xx). Si hubo un corte de
    // red, un timeout o una respuesta ilegible no se sabe si la difusión salió, y reintentarla podría duplicarla.
    readonly retrySafe = false
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

// ---------------------------------------------------------------------------------------------
// Proveedor simulado: guarda todo en memoria. Sirve para desarrollar y probar sin cuenta ni dominio.
// Nunca envía nada, y en producción no se usa (ver getEmailProvider).
// ---------------------------------------------------------------------------------------------

export interface MockEmailProvider extends EmailProvider {
  readonly name: 'mock'
  readonly sent: EmailMessage[]
  readonly contacts: Map<string, { locale: Locale; unsubscribed: boolean }>
  readonly broadcasts: (BroadcastInput & { id: string })[]
  // Para probar cómo reacciona el código cuando el proveedor falla
  // broadcast: el proveedor rechaza la difusión (seguro reintentar). broadcastUnknown: se pierde la respuesta
  // y no se sabe si salió.
  readonly failing: { transactional: boolean; contacts: boolean; broadcast: boolean; broadcastUnknown: boolean }
}

export function createMockProvider({ verbose = false }: { verbose?: boolean } = {}): MockEmailProvider {
  const sent: EmailMessage[] = []
  const contacts = new Map<string, { locale: Locale; unsubscribed: boolean }>()
  const broadcasts: (BroadcastInput & { id: string })[] = []
  const failing = { transactional: false, contacts: false, broadcast: false, broadcastUnknown: false }

  return {
    name: 'mock',
    sent,
    contacts,
    broadcasts,
    failing,
    async sendTransactional(message) {
      if (failing.transactional) throw new ProviderError('mock: fallo simulado al enviar')
      sent.push(message)
      if (verbose) console.info(`[email:simulado] a ${message.to} — ${message.subject}\n${message.text}`)
    },
    async upsertContact({ email, locale }) {
      if (failing.contacts) throw new ProviderError('mock: fallo simulado en contactos')
      contacts.set(email, { locale, unsubscribed: false })
    },
    async unsubscribeContact(email) {
      if (failing.contacts) throw new ProviderError('mock: fallo simulado en contactos')
      const current = contacts.get(email)
      if (current) contacts.set(email, { ...current, unsubscribed: true })
    },
    async sendBroadcast(input) {
      if (failing.broadcast) throw new ProviderError('mock: fallo simulado en la difusión', 422, true)
      if (failing.broadcastUnknown) throw new ProviderError('mock: respuesta perdida, no se sabe si salió')
      const id = `mock-broadcast-${broadcasts.length + 1}`
      broadcasts.push({ ...input, id })
      if (verbose) console.info(`[email:simulado] difusión ${input.locale} — ${input.subject}`)
      return { id }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Resend. Rutas y campos tomados de su documentación (consultada el 2026-10-27):
//   POST /emails · POST /contacts · PATCH /contacts/{email} · POST /broadcasts (con send: true)
// El marcador {{{RESEND_UNSUBSCRIBE_URL}}} lo sustituye Resend en cada difusión.
// ---------------------------------------------------------------------------------------------

export interface ResendConfig {
  apiKey: string
  from: string
  replyTo?: string
  // En Resend las antiguas "audiencias" se llaman segmentos
  segments: Partial<Record<Locale, string>>
  fetchImpl?: typeof fetch
}

const RESEND_API = 'https://api.resend.com'
// Sin tope, una petición colgada dejaría el envío del resumen en "sending" para siempre
const REQUEST_TIMEOUT_MS = 20_000

export function createResendProvider(config: ResendConfig): EmailProvider {
  const fetchImpl = config.fetchImpl ?? fetch

  async function request(method: 'POST' | 'PATCH', path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
    return fetchImpl(`${RESEND_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  }

  async function failure(response: Response, action: string): Promise<ProviderError> {
    // Se registra el estado y el cuerpo del error del proveedor, nunca la llave
    const detail = await response.text().catch(() => '')
    // Un 4xx (salvo 408) es un rechazo claro: no se procesó nada. Un 5xx o 408 deja la duda.
    const retrySafe = response.status >= 400 && response.status < 500 && response.status !== 408
    return new ProviderError(`Resend: ${action} falló (${response.status}) ${detail.slice(0, 300)}`, response.status, retrySafe)
  }

  return {
    name: 'resend',

    async sendTransactional(message) {
      const response = await request(
        'POST',
        '/emails',
        {
          from: config.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        },
        message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}
      )
      if (!response.ok) throw await failure(response, 'enviar el correo')
    },

    async upsertContact({ email, locale }) {
      const segment = config.segments[locale]
      const created = await request('POST', '/contacts', {
        email,
        unsubscribed: false,
        ...(segment ? { segments: [{ id: segment }] } : {}),
      })
      if (created.ok) return
      // El contacto ya existía (p. ej. se dio de baja y vuelve a suscribirse): se reactiva.
      // Los códigos 409 y 422 son una suposición sobre cómo responde Resend; confirmar con una cuenta real.
      if (created.status === 409 || created.status === 422) {
        const reactivated = await request('PATCH', `/contacts/${encodeURIComponent(email)}`, { unsubscribed: false })
        if (reactivated.ok) return
        throw await failure(reactivated, 'reactivar el contacto')
      }
      throw await failure(created, 'crear el contacto')
    },

    async unsubscribeContact(email) {
      const response = await request('PATCH', `/contacts/${encodeURIComponent(email)}`, { unsubscribed: true })
      // Si el contacto nunca llegó al proveedor (no confirmó el alta) no hay nada que dar de baja
      if (response.ok || response.status === 404) return
      throw await failure(response, 'dar de baja el contacto')
    },

    async sendBroadcast({ locale, name, subject, html, text }) {
      const segment = config.segments[locale]
      if (!segment) throw new ProviderError(`Resend: falta el segmento del idioma ${locale}`, undefined, true)
      const response = await request('POST', '/broadcasts', {
        segment_id: segment,
        from: config.from,
        subject,
        html,
        text,
        name,
        send: true,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      })
      if (!response.ok) throw await failure(response, 'crear la difusión')
      const body = (await response.json().catch(() => null)) as { id?: string } | null
      if (!body?.id) throw new ProviderError('Resend: la difusión no devolvió un id')
      return { id: body.id }
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Elección en tiempo de ejecución
// ---------------------------------------------------------------------------------------------

let sharedMock: MockEmailProvider | null = null

export function getEmailProvider(env: Record<string, string | undefined> = process.env): EmailProvider | null {
  const apiKey = env.RESEND_API_KEY
  if (apiKey) {
    // Con llave pero sin remitente no se puede enviar: mejor "no disponible" que enviar desde una dirección ajena
    if (!env.EMAIL_FROM) return null
    return createResendProvider({
      apiKey,
      from: env.EMAIL_FROM,
      replyTo: env.EMAIL_REPLY_TO,
      segments: { es: env.RESEND_SEGMENT_ES, en: env.RESEND_SEGMENT_EN },
    })
  }

  // Sin llave: en desarrollo se usa el simulado; en producción el boletín queda desactivado
  if (env.NODE_ENV === 'production') return null
  sharedMock ??= createMockProvider({ verbose: true })
  return sharedMock
}
