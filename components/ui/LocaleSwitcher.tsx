'use client'

import { clsx } from 'clsx'
import { useLocale } from '@/lib/i18n/LocaleProvider'

interface LocaleSwitcherProps {
  className?: string
}

// Pill-segmented ES|EN control. Reads/writes locale through LocaleContext, so it works wherever it's
// dropped (Header row B, Footer nav) as long as it's rendered inside the site's LocaleProvider.
export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, dictionary, setLocale } = useLocale()

  return (
    <div
      role="group"
      aria-label={dictionary.common.languageLabel}
      className={clsx('inline-flex items-center rounded-full border border-hairline bg-white/[0.04] p-0.5 text-micro font-semibold', className)}
    >
      <button
        type="button"
        onClick={() => setLocale('es')}
        aria-pressed={locale === 'es'}
        aria-label={dictionary.common.switchToEs}
        className={clsx(
          'rounded-full px-2 py-1 transition-colors',
          locale === 'es' ? 'bg-accent-blue text-canvas' : 'text-ink-muted hover:text-ink'
        )}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        aria-label={dictionary.common.switchToEn}
        className={clsx(
          'rounded-full px-2 py-1 transition-colors',
          locale === 'en' ? 'bg-accent-blue text-canvas' : 'text-ink-muted hover:text-ink'
        )}
      >
        EN
      </button>
    </div>
  )
}
