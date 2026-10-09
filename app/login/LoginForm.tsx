'use client'

import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useDictionary } from '@/lib/i18n/LocaleProvider'

type Notice = { tone: 'error' | 'info'; text: string; canResend?: boolean }

export function LoginForm({
  forbidden,
  recovery,
  error,
}: {
  forbidden: boolean
  recovery?: boolean
  error?: string
}) {
  const dict = useDictionary().login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [notice, setNotice] = useState<Notice | null>(error === 'enlace' ? { tone: 'error', text: dict.errorInvalidLink } : null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.code === 'email_not_confirmed') {
        setNotice({ tone: 'error', text: dict.errorEmailNotConfirmed, canResend: true })
      } else if (error.code === 'invalid_credentials') {
        setNotice({ tone: 'error', text: dict.errorInvalidCredentials })
      } else {
        setNotice({ tone: 'error', text: dict.errorGenericSignIn })
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
    setNotice(error ? { tone: 'error', text: dict.errorResendFailed } : { tone: 'info', text: dict.infoResendSuccess })
  }

  const handleSignOut = async () => {
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  const handleForgotPassword = async () => {
    if (!email) return
    setLoading(true)
    setNotice(null)

    const origin = window.location.origin
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?recovery=1`,
    })

    setNotice(error ? { tone: 'error', text: dict.errorRecoveryFailed } : { tone: 'info', text: dict.infoRecoverySuccess })
    setLoading(false)
  }

  const handleSetNewPassword = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setNotice(null)

    const { error } = await createClient().auth.updateUser({ password: newPassword })

    if (error) {
      setNotice({ tone: 'error', text: dict.errorPasswordUpdateFailed })
      setLoading(false)
      return
    }

    window.location.assign('/cms')
  }

  if (recovery) {
    return (
      <form onSubmit={handleSetNewPassword} className="space-y-5">
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
          </div>
        )}

        <Input
          label={dict.newPasswordLabel}
          placeholder={dict.newPasswordPlaceholder}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          {dict.saveNewPassword}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {forbidden && (
        <div role="alert" className="rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-body-sm text-ink">
          {dict.forbiddenNotice}{' '}
          <button type="button" onClick={handleSignOut} className="underline">
            {dict.signOut}
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
                {dict.resendEmail}
              </button>
            </>
          )}
        </div>
      )}

      <Input
        label={dict.emailLabel}
        placeholder={dict.emailPlaceholder}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div>
        <Input
          label={dict.passwordLabel}
          placeholder={dict.passwordPlaceholder}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={!email || loading}
          className="mt-2 text-body-sm text-ink-muted underline transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dict.forgotPassword}
        </button>
      </div>
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        {dict.submit}
      </Button>
    </form>
  )
}
