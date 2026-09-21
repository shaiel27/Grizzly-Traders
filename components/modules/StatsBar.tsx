interface StatsBarProps {
  postCount: number
  categoryCount: number
  assetCount: number
  sourceCount: number
}

export function StatsBar({ postCount, categoryCount, assetCount, sourceCount }: StatsBarProps) {
  const stats = [
    { icon: 'article', label: 'Artículos publicados', value: postCount.toLocaleString('es-ES') },
    { icon: 'category', label: 'Categorías activas', value: categoryCount.toString() },
    { icon: 'candlestick_chart', label: 'Activos rastreados', value: assetCount.toString() },
    { icon: 'hub', label: 'Fuentes monitoreadas', value: sourceCount.toLocaleString('es-ES') },
  ]

  return (
    <section className="mb-8 rounded-xl border border-hairline-soft bg-surface-1/50 p-4" aria-label="Estadísticas del portal">
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
