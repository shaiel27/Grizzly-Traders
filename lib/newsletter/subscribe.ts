import { z } from 'zod'
import type { Locale } from '@/lib/i18n/get-dictionary'
import type { EmailProvider } from '@/lib/email/provider'
import { renderConfirmationEmail, renderUnsubscribeRequestEmail } from '@/lib/email/templates'
import { generateToken, hashIp, hashToken, isExpired, TOKEN_TTL_MS, withinCooldown } from './tokens'

// Alta con doble confirmación, confirmación y baja. La lógica no conoce Supabase ni a Resend:
// recibe un repositorio y un proveedor, así se prueba entera sin red ni base de datos.

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed'
export type TokenPurpose = 'confirm' | 'unsubscribe'

export interface SubscriberRecord {
  id: string
  email: string
  status: SubscriberStatus
  locale: Locale
  consented_at: string | null
  consent_text: string | null
  source_url: string | null
  ip_hash: string | null
  token_hash: string | null
  token_purpose: TokenPurpose | null
  token_expires_at: string | null
  token_sent_at: string | null
  confirmed_at: string | null
  unsubscribed_at: string | null
}

export type NewSubscriber = Omit<SubscriberRecord, 'id'>
export type SubscriberPatch = Partial<Omit<SubscriberRecord, 'id' | 'email'>>

export interface SubscriberRepo {
  findByEmail(email: string): Promise<SubscriberRecord | null>
  findByTokenHash(hash: string): Promise<SubscriberRecord | null>
  // 'duplicate' cuando otra petición ya insertó ese correo (índice único): no es un error
  insert(row: NewSubscriber): Promise<'inserted' | 'duplicate'>
  update(id: string, patch: SubscriberPatch): Promise<void>
}

export interface NewsletterDeps {
  repo: SubscriberRepo
  provider: EmailProvider
  siteUrl: string
  // URL pública (https) del logo de los correos; sin ella se usa `${siteUrl}/logo.png`
  logoUrl?: string
  postalAddress?: string
  // Sal para guardar la IP como hash; sin ella no se guarda nada
  ipSalt?: string
  now?: () => Date
  newToken?: () => string
}

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email())

function clock(deps: NewsletterDeps): Date {
  return (deps.now ?? (() => new Date()))()
}

function token(deps: NewsletterDeps): string {
  return (deps.newToken ?? generateToken)()
}

function baseUrl(deps: NewsletterDeps): string {
  return deps.siteUrl.replace(/\/+$/, '')
}

// Si el correo no pudo enviarse, la espera de 60 s no debe seguir corriendo: de lo contrario un reintento
// inmediato respondería "ok" sin enviar nada y la persona se quedaría esperando un correo que no existe.
async function releaseCooldown(email: string, deps: NewsletterDeps): Promise<void> {
  try {
    const row = await deps.repo.findByEmail(email)
    if (row) await deps.repo.update(row.id, { token_sent_at: null })
  } catch (error) {
    console.error('Newsletter: no se pudo liberar la espera', error instanceof Error ? error.message : error)
  }
}

export type SubscribeFailure = 'invalid_email' | 'consent_required' | 'failed'
export type SubscribeResult = { ok: true } | { ok: false; code: SubscribeFailure }

export interface SubscribeInput {
  email: string
  consent: boolean
  locale: Locale
  // Texto exacto de la casilla que la persona aceptó, en su idioma
  consentText: string
  sourceUrl?: string | null
  ip?: string | null
}

// Siempre responde "ok" para un correo ya confirmado o en espera: así nadie puede averiguar
// quién está en la lista probando direcciones.
export async function requestSubscription(input: SubscribeInput, deps: NewsletterDeps): Promise<SubscribeResult> {
  const parsed = emailSchema.safeParse(input.email)
  if (!parsed.success) return { ok: false, code: 'invalid_email' }
  if (!input.consent) return { ok: false, code: 'consent_required' }

  const email = parsed.data
  const now = clock(deps)
  const existing = await deps.repo.findByEmail(email)

  // Pendiente o ya confirmado que lo pide otra vez dentro de la espera: misma respuesta, sin otro correo
  if (
    (existing?.status === 'pending' || existing?.status === 'confirmed') &&
    existing.token_purpose === 'confirm' &&
    withinCooldown(existing.token_sent_at, now)
  ) {
    return { ok: true }
  }

  const raw = token(deps)
  const tokenFields = {
    token_hash: hashToken(raw),
    token_purpose: 'confirm' as const,
    token_expires_at: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
    token_sent_at: now.toISOString(),
  }
  const fields = {
    locale: input.locale,
    consented_at: now.toISOString(),
    consent_text: input.consentText,
    source_url: input.sourceUrl ?? null,
    ip_hash: input.ip && deps.ipSalt ? hashIp(input.ip, deps.ipSalt) : null,
    ...tokenFields,
  }
  // Un confirmado que vuelve a pedirlo puede haberse dado de baja desde el enlace de Resend sin que Supabase lo
  // sepa. Se le reenvía el enlace de confirmación (al pulsarlo se reactiva el contacto) y no se toca su estado
  // ni su registro de consentimiento: un tercero no puede sobrescribirlos solo por escribir su correo.
  const resubscribing = existing?.status === 'confirmed'
  const emailLocale = existing && resubscribing ? existing.locale : input.locale

  if (existing && resubscribing) {
    await deps.repo.update(existing.id, tokenFields)
  } else if (existing) {
    // Pendiente que vuelve a pedirlo, o dado de baja que se suscribe de nuevo: exige confirmar otra vez
    await deps.repo.update(existing.id, { ...fields, status: 'pending', confirmed_at: null, unsubscribed_at: null })
  } else {
    const inserted = await deps.repo.insert({
      email,
      status: 'pending',
      confirmed_at: null,
      unsubscribed_at: null,
      ...fields,
    })
    if (inserted === 'duplicate') return { ok: true }
  }

  const message = renderConfirmationEmail({
    locale: emailLocale,
    url: `${baseUrl(deps)}/newsletter/confirmar?token=${raw}`,
    siteUrl: baseUrl(deps),
    logoUrl: deps.logoUrl,
    postalAddress: deps.postalAddress,
  })

  try {
    await deps.provider.sendTransactional({ to: email, ...message, idempotencyKey: `confirm-${fields.token_hash.slice(0, 40)}` })
  } catch (error) {
    console.error('Newsletter: no se pudo enviar la confirmación', error instanceof Error ? error.message : error)
    await releaseCooldown(email, deps)
    return { ok: false, code: 'failed' }
  }

  return { ok: true }
}

export type ConfirmResult = 'confirmed' | 'already' | 'invalid' | 'expired' | 'failed'

export async function confirmSubscription(rawToken: string, deps: NewsletterDeps): Promise<ConfirmResult> {
  if (!rawToken) return 'invalid'
  const record = await deps.repo.findByTokenHash(hashToken(rawToken))
  if (!record || record.token_purpose !== 'confirm') return 'invalid'
  // Enlace ya usado: la persona lo pulsó dos veces. Uno nuevo (alguien ya confirmado que vuelve a suscribirse
  // tras darse de baja desde Resend) no está usado y sigue adelante para reactivar el contacto.
  if (record.status === 'confirmed' && tokenUsed(record)) return 'already'
  // Un enlace de confirmación viejo no puede reactivar a quien ya se dio de baja
  if (record.status === 'unsubscribed') return 'invalid'
  if (isExpired(record.token_expires_at, clock(deps))) return 'expired'

  // Primero el proveedor: si falla, el enlace sigue vigente y la persona puede volver a pulsarlo
  try {
    await deps.provider.upsertContact({ email: record.email, locale: record.locale })
  } catch (error) {
    console.error('Newsletter: no se pudo crear el contacto', error instanceof Error ? error.message : error)
    return 'failed'
  }

  // Al confirmar el token queda gastado: su vencimiento pasa a ser el momento de la confirmación
  const confirmedAt = clock(deps).toISOString()
  await deps.repo.update(record.id, { status: 'confirmed', confirmed_at: confirmedAt, token_expires_at: confirmedAt })
  return 'confirmed'
}

function tokenUsed(record: SubscriberRecord): boolean {
  if (!record.confirmed_at || !record.token_expires_at) return false
  return Date.parse(record.token_expires_at) <= Date.parse(record.confirmed_at)
}

export type UnsubscribeRequestResult = { ok: true } | { ok: false; code: 'invalid_email' | 'failed' }

// Pide la baja por correo: se envía un enlace al propio suscriptor, para que nadie pueda dar de baja a otra persona.
// Responde igual exista o no la dirección.
export async function requestUnsubscribe(emailInput: string, locale: Locale, deps: NewsletterDeps): Promise<UnsubscribeRequestResult> {
  const parsed = emailSchema.safeParse(emailInput)
  if (!parsed.success) return { ok: false, code: 'invalid_email' }

  const email = parsed.data
  const now = clock(deps)
  const existing = await deps.repo.findByEmail(email)
  if (!existing || existing.status === 'unsubscribed') return { ok: true }
  if (existing.token_purpose === 'unsubscribe' && withinCooldown(existing.token_sent_at, now)) return { ok: true }

  const raw = token(deps)
  const hash = hashToken(raw)
  await deps.repo.update(existing.id, {
    token_hash: hash,
    token_purpose: 'unsubscribe',
    token_expires_at: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
    token_sent_at: now.toISOString(),
  })

  const message = renderUnsubscribeRequestEmail({
    locale: existing.locale ?? locale,
    url: `${baseUrl(deps)}/newsletter/baja?token=${raw}`,
    siteUrl: baseUrl(deps),
    logoUrl: deps.logoUrl,
    postalAddress: deps.postalAddress,
  })

  try {
    await deps.provider.sendTransactional({ to: email, ...message, idempotencyKey: `unsubscribe-${hash.slice(0, 40)}` })
  } catch (error) {
    console.error('Newsletter: no se pudo enviar la solicitud de baja', error instanceof Error ? error.message : error)
    await releaseCooldown(email, deps)
    return { ok: false, code: 'failed' }
  }

  return { ok: true }
}

export type UnsubscribeResult = 'unsubscribed' | 'already' | 'invalid' | 'expired' | 'failed'

export async function confirmUnsubscribe(rawToken: string, deps: NewsletterDeps): Promise<UnsubscribeResult> {
  if (!rawToken) return 'invalid'
  const record = await deps.repo.findByTokenHash(hashToken(rawToken))
  if (!record || record.token_purpose !== 'unsubscribe') return 'invalid'
  if (record.status === 'unsubscribed') return 'already'
  if (isExpired(record.token_expires_at, clock(deps))) return 'expired'

  try {
    await deps.provider.unsubscribeContact(record.email)
  } catch (error) {
    console.error('Newsletter: no se pudo dar de baja el contacto', error instanceof Error ? error.message : error)
    return 'failed'
  }

  await deps.repo.update(record.id, { status: 'unsubscribed', unsubscribed_at: clock(deps).toISOString() })
  return 'unsubscribed'
}
