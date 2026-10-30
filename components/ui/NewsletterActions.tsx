'use client'

import { useId, useState, type FormEvent } from 'react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { Dictionary } from '@/lib/i18n/get-dictionary'

type Pages = Dictionary['newsletterPages']
type Outcome = { kind: 'idle' } | { kind: 'working' } | { kind: 'done'; message: string } | { kind: 'error'; message: string }

// Códigos de la API → clave del diccionario (los de la API van en snake_case)
const CODE_KEYS: Record<string, 'invalid' | 'expired' | 'failed' | 'unavailable' | 'rateLimited' | 'invalidEmail'> = {
  invalid: 'invalid',
  expired: 'expired',
  failed: 'failed',
  unavailable: 'unavailable',
  rate_limited: 'rateLimited',
  invalid_email: 'invalidEmail',
}

function messageFor(copy: Record<string, string>, code: unknown): string {
  const key = typeof code === 'string' ? CODE_KEYS[code] : undefined
  return (key && copy[key]) || copy.failed
}

// Botón de una sola acción para los enlaces de los correos. Se confirma con un clic y un POST: abrir el
// enlace (por ejemplo, un antivirus que lo visita) no cambia nada por sí solo.
export function NewsletterTokenAction({ mode, token }: { mode: 'confirm' | 'unsubscribe'; token: string }) {
  const { dictionary } = useLocale()
  const pages: Pages = dictionary.newsletterPages
  const copy = (mode === 'confirm' ? pages.confirm : pages.unsubscribe) as Record<string, string>
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })

  const endpoint = mode === 'confirm' ? '/api/subscribe/confirm' : '/api/subscribe/unsubscribe/confirm'
  const buttonLabel = mode === 'confirm' ? pages.confirm.button : pages.unsubscribe.confirmButton
  const workingLabel = mode === 'confirm' ? pages.confirm.working : pages.unsubscribe.working

  const run = async () => {
    setOutcome({ kind: 'working' })
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.success) {
        setOutcome({ kind: 'done', message: body.result === 'already' ? copy.already : copy.success })
      } else {
        setOutcome({ kind: 'error', message: messageFor(copy, body?.code) })
      }
    } catch {
      setOutcome({ kind: 'error', message: copy.networkError })
    }
  }

  return (
    <div>
      {outcome.kind !== 'done' && (
        <button type="button" onClick={run} disabled={outcome.kind === 'working'} className="btn-primary disabled:opacity-60">
          {outcome.kind === 'working' ? workingLabel : buttonLabel}
        </button>
      )}
      <p role="status" className="mt-4 min-h-6 text-body-sm">
        {outcome.kind === 'done' && <span className="text-semantic-success">{outcome.message}</span>}
        {outcome.kind === 'error' && <span className="text-semantic-danger">{outcome.message}</span>}
      </p>
    </div>
  )
}

// Formulario para pedir un enlace de baja (cuando la persona llega sin token)
export function UnsubscribeRequestForm() {
  const id = useId()
  const { locale, dictionary } = useLocale()
  const copy = dictionary.newsletterPages.unsubscribe as Record<string, string>
  const [email, setEmail] = useState('')
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setOutcome({ kind: 'working' })
    try {
      const response = await fetch('/api/subscribe/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })
      const body = await response.json().catch(() => null)
      if (response.ok && body?.success) {
        setEmail('')
        setOutcome({ kind: 'done', message: copy.requestSent })
      } else {
        setOutcome({ kind: 'error', message: messageFor(copy, body?.code) })
      }
    } catch {
      setOutcome({ kind: 'error', message: copy.networkError })
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <label htmlFor={`${id}-email`} className="mb-2 block text-body-sm font-medium text-ink">
        {copy.emailLabel}
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={copy.emailPlaceholder}
          className="min-w-0 flex-1 rounded-full border border-outline-variant/70 bg-canvas/70 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
        />
        <button type="submit" disabled={outcome.kind === 'working'} className="btn-primary shrink-0 disabled:opacity-60">
          {outcome.kind === 'working' ? copy.requestSending : copy.requestButton}
        </button>
      </div>
      <p role="status" className="mt-3 min-h-6 text-body-sm">
        {outcome.kind === 'done' && <span className="text-semantic-success">{outcome.message}</span>}
        {outcome.kind === 'error' && <span className="text-semantic-danger">{outcome.message}</span>}
      </p>
    </form>
  )
}
