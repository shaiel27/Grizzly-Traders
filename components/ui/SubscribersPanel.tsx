'use client'

import { useCallback, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Card } from '@/components/ui'
import { t } from '@/lib/i18n/get-dictionary'
import { useDictionary, useLocale } from '@/lib/i18n/LocaleProvider'
import type { SubscriberStats } from '@/lib/newsletter/stats'

// Panel del CMS con las cifras de la lista de correo. Solo conteos: nunca se muestran ni se descargan correos.

type State = { phase: 'loading' } | { phase: 'ready'; stats: SubscriberStats } | { phase: 'error'; code: string }

function Metric({ label, value, hint, strong = false }: { label: string; value: number; hint?: string; strong?: boolean }) {
  const { locale } = useLocale()
  return (
    <div className={clsx('rounded-xl border border-hairline p-4', strong ? 'bg-accent-blue/[0.07]' : 'bg-surface-2/60')}>
      <p className="text-micro font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={clsx('mt-1 font-serif font-bold tabular-nums text-ink', strong ? 'text-[44px] leading-none' : 'text-[28px] leading-tight')}>
        {value.toLocaleString(locale === 'en' ? 'en-US' : 'es-ES')}
      </p>
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">{hint}</p>}
    </div>
  )
}

export function SubscribersPanel() {
  const dict = useDictionary().cms.subscribers
  const { locale } = useLocale()
  const [state, setState] = useState<State>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const response = await fetch('/api/newsletter/stats', { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as { success?: boolean; data?: SubscriberStats; code?: string } | null
      if (response.ok && body?.success && body.data) setState({ phase: 'ready', stats: body.data })
      else setState({ phase: 'error', code: body?.code ?? 'error' })
    } catch {
      setState({ phase: 'error', code: 'error' })
    }
  }, [])

  useEffect(() => {
    // La carga inicial es un efecto de sincronización con el servidor, no un estado derivado
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const formatDate = (isoDay: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDay}T12:00:00Z`))

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-headline font-bold text-ink">{dict.title}</h2>
          <p className="mt-1 max-w-2xl text-body-sm text-ink-muted">{dict.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={state.phase === 'loading'}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dict.refresh}
        </button>
      </div>

      {state.phase === 'loading' && (
        <p role="status" className="py-10 text-center text-body-sm text-ink-muted">
          {dict.loading}
        </p>
      )}

      {state.phase === 'error' && (
        <p role="alert" className="rounded-xl border border-semantic-danger/40 bg-semantic-danger/[0.07] px-4 py-3 text-body-sm text-ink">
          {state.code === 'no_configurado' ? dict.notConfigured : state.code === 'sin_migracion' ? dict.noMigration : dict.error}
        </p>
      )}

      {state.phase === 'ready' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Metric strong label={dict.verified} value={state.stats.verified} hint={dict.verifiedHint} />
            <Metric label={dict.spanish} value={state.stats.verifiedByLocale.es} />
            <Metric label={dict.english} value={state.stats.verifiedByLocale.en} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={dict.newWeek} value={state.stats.verifiedLast7Days} />
            <Metric label={dict.newMonth} value={state.stats.verifiedLast30Days} />
            <Metric label={dict.pending} value={state.stats.pending} hint={dict.pendingHint} />
            <Metric label={dict.unsubscribed} value={state.stats.unsubscribed} hint={dict.unsubscribedHint} />
          </div>

          <div className="flex flex-col gap-1 border-t border-hairline pt-4 text-body-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-medium text-ink">{dict.lastDigest}:</span>{' '}
              {state.stats.lastDigest ? `${formatDate(state.stats.lastDigest.date)} (${state.stats.lastDigest.locales.map((l) => l.toUpperCase()).join(' + ')})` : dict.lastDigestNone}
            </p>
            <p className="text-[12px] tabular-nums">
              {t(dict.updatedAt, { time: new Date(state.stats.generatedAt).toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-ES', { hour: '2-digit', minute: '2-digit' }) })}
            </p>
          </div>
          <p className="text-[12px] text-ink-subtle">{dict.limitNote}</p>
        </div>
      )}
    </Card>
  )
}
