import { sentimentMeta } from '@/lib/feed'
import { getDictionary, t, type Locale } from '@/lib/i18n/get-dictionary'

interface SentimentSummaryProps {
  bullish: number
  bearish: number
  neutral: number
  total: number
  days: number
  locale?: Locale
}

const SEGMENT_KEYS = [
  { key: 'bullish' as const, bar: 'bg-semantic-success', text: 'text-semantic-success' },
  { key: 'neutral' as const, bar: 'bg-ink-subtle', text: 'text-ink-muted' },
  { key: 'bearish' as const, bar: 'bg-semantic-danger', text: 'text-semantic-danger' },
]

export function SentimentSummary({ bullish, bearish, neutral, total, days, locale = 'es' }: SentimentSummaryProps) {
  if (total === 0) return null

  const dict = getDictionary(locale)
  const counts = { bullish, bearish, neutral }
  // Reuses lib/feed.ts's sentimentMeta for the segment labels, so "Alcista/Bajista/Neutral" has one
  // source of truth across the whole site instead of a second copy living in this dictionary.
  const segments = SEGMENT_KEYS.map((s) => ({ ...s, label: sentimentMeta(s.key, locale).label }))

  return (
    <section className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4" aria-label={dict.home.sentimentAria}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-caption font-bold text-ink">{dict.home.sentimentTitle}</h2>
        <p className="text-micro text-ink-muted">
          {t(dict.home.sentimentPeriod, {
            days,
            n: total,
            unit: total === 1 ? dict.home.sentimentUnitSingular : dict.home.sentimentUnitPlural,
          })}
        </p>
      </div>

      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={t(dict.home.sentimentBarAria, { bullish, neutral, bearish })}
      >
        {segments.map((segment) => {
          const count = counts[segment.key]
          return count > 0 ? <div key={segment.key} className={segment.bar} style={{ width: `${(count / total) * 100}%` }} /> : null
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-micro">
            <span className={`size-2 rounded-full ${segment.bar}`} aria-hidden="true" />
            <span className="text-ink-muted">{segment.label}</span>
            <span className={`font-mono font-bold tabular-nums ${segment.text}`}>
              {counts[segment.key]} ({Math.round((counts[segment.key] / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
