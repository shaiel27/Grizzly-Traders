import { getDictionary, type Locale } from '@/lib/i18n/get-dictionary'

interface StatsBarProps {
  postCount: number
  categoryCount: number
  assetCount: number
  sourceCount: number
  locale?: Locale
}

export function StatsBar({ postCount, categoryCount, assetCount, sourceCount, locale = 'es' }: StatsBarProps) {
  const dict = getDictionary(locale).home
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES'
  const stats = [
    { icon: 'article', label: dict.statsArticles, value: postCount.toLocaleString(numberLocale) },
    { icon: 'category', label: dict.statsCategories, value: categoryCount.toString() },
    { icon: 'candlestick_chart', label: dict.statsAssets, value: assetCount.toString() },
    { icon: 'hub', label: dict.statsSources, value: sourceCount.toLocaleString(numberLocale) },
  ]

  return (
    <section className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4" aria-label={dict.statsAria}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-hairline-soft bg-surface-2/50">
              <span className="material-symbols-outlined text-[18px] text-accent-blue" aria-hidden="true">
                {stat.icon}
              </span>
            </span>
            <div>
              <div className="font-mono text-sm font-semibold tabular-nums text-ink">{stat.value}</div>
              <div className="text-[11px] text-ink-muted">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
