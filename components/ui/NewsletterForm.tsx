'use client'

import { useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useDictionary } from '@/lib/i18n/LocaleProvider'

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done' } | { kind: 'error'; message: string }

export function NewsletterForm() {
  const id = useId()
  const dict = useDictionary()
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus({ kind: 'loading' })

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      })
      const body = await response.json().catch(() => null)

      if (response.ok && body?.success) {
        setEmail('')
        setStatus({ kind: 'done' })
      } else {
        setStatus({ kind: 'error', message: body?.error ?? 'No se pudo completar la suscripción.' })
      }
    } catch {
      setStatus({ kind: 'error', message: 'Error de conexión. Inténtalo de nuevo.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md" aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={`${id}-email`} className="mb-2 block text-body-sm font-medium text-ink">
        Recibe las novedades del portal por correo
      </label>

      <div className="flex gap-2">
        <input
          id={`${id}-email`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
          className="min-w-0 flex-1 rounded-full border border-outline-variant/70 bg-canvas/70 px-4 py-2.5 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
        />
        <button type="submit" disabled={status.kind === 'loading'} className="btn-primary shrink-0 disabled:opacity-60">
          {status.kind === 'loading' ? 'Enviando…' : 'Suscribirme'}
        </button>
      </div>

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No rellenar
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      <p role="status" className="mt-2 min-h-5 text-micro">
        {status.kind === 'done' && <span className="text-semantic-success">¡Listo! Te avisaremos de las novedades.</span>}
        {status.kind === 'error' && <span className="text-semantic-danger">{status.message}</span>}
      </p>

      <p className="mt-2 text-micro text-ink-subtle">
        {dict.footer.newsletterConsentPrefix}{' '}
        <Link href="/legal/privacidad" className="font-medium text-ink-muted underline hover:text-ink">
          {dict.footer.newsletterConsentLink}
        </Link>
        .
      </p>
    </form>
  )
}
