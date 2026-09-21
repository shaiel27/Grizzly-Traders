interface SentimentSummaryProps {
  bullish: number
  bearish: number
  neutral: number
  total: number
  days: number
}

const SEGMENTS = [
  { key: 'bullish', label: 'Alcista', bar: 'bg-semantic-success', text: 'text-semantic-success' },
  { key: 'neutral', label: 'Neutral', bar: 'bg-ink-subtle', text: 'text-ink-muted' },
  { key: 'bearish', label: 'Bajista', bar: 'bg-semantic-danger', text: 'text-semantic-danger' },
] as const

export function SentimentSummary({ bullish, bearish, neutral, total, days }: SentimentSummaryProps) {
  if (total === 0) return null

  const counts = { bullish, bearish, neutral }

  return (
    <section className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4" aria-label="Sentimiento editorial">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-caption font-bold text-ink">Sentimiento de nuestras noticias</h2>
        <p className="text-micro text-ink-muted">
          Últimos {days} días · {total} {total === 1 ? 'artículo' : 'artículos'}
        </p>
      </div>

      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`Alcista ${bullish}, neutral ${neutral}, bajista ${bearish}`}
      >
        {SEGMENTS.map((segment) => {
          const count = counts[segment.key]
          return count > 0 ? <div key={segment.key} className={segment.bar} style={{ width: `${(count / total) * 100}%` }} /> : null
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        {SEGMENTS.map((segment) => (
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
