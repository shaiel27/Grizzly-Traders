'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Notice = { tone: 'error' | 'info'; text: string; canResend?: boolean }

export function LoginForm({ forbidden }: { forbidden: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.code === 'email_not_confirmed') {
        setNotice({
          tone: 'error',
          text: 'Tu correo aún no está confirmado. Confírmalo desde el mensaje que envía Supabase para poder entrar.',
          canResend: true,
        })
      } else if (error.code === 'invalid_credentials') {
        setNotice({ tone: 'error', text: 'Correo o contraseña incorrectos.' })
      } else {
        setNotice({ tone: 'error', text: 'No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.' })
      }
      setLoading(false)
      return
    }

    // Full navigation on purpose: a soft navigation can reuse the prefetched /cms redirect
    // (cached while logged out) and bounce straight back to /login.
    window.location.assign('/cms')
  }

  const handleResend = async () => {
    const { error } = await createClient().auth.resend({ type: 'signup', email })
    setNotice(
      error
        ? { tone: 'error', text: 'No se pudo reenviar el correo de confirmación.' }
        : { tone: 'info', text: 'Te enviamos un nuevo correo de confirmación. Revisa también la carpeta de spam.' }
    )
  }

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {forbidden && (
        <div role="alert" className="rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-body-sm text-ink">
          Tu cuenta no tiene permisos de editor.{' '}
          <button type="button" onClick={handleSignOut} className="underline">
            Cerrar sesión
          </button>
        </div>
      )}

      {notice && (
        <div
          role="alert"
          className={
            notice.tone === 'error'
              ? 'rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-body-sm text-ink'
              : 'rounded-xl border border-accent-blue/40 bg-accent-blue/10 p-3 text-body-sm text-ink'
          }
        >
          {notice.text}
          {notice.canResend && (
            <>
              {' '}
              <button type="button" onClick={handleResend} className="underline">
                Reenviar correo
              </button>
            </>
          )}
        </div>
      )}

      <Input
        label="Correo"
        placeholder="tu@correo.com"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label="Contraseña"
        placeholder="Tu contraseña"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Entrar
      </Button>
    </form>
  )
}
