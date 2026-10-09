import { Loading as LoadingComponent } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export default async function ArticulosLoading() {
  const locale = await getServerLocale()
  const dict = getDictionary(locale).loadingStates
  return (
    <main className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container mb-8 pt-8" role="status" aria-live="polite">
        <div className="mb-2 h-10 w-72 animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
        <div className="h-4 w-96 max-w-full animate-pulse motion-reduce:animate-none rounded bg-surface-2" />
        <span className="sr-only">{dict.content}</span>
      </div>

      <div className="section-container mb-8 flex flex-wrap gap-2" role="status" aria-live="polite">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse motion-reduce:animate-none rounded-full bg-surface-2" />
        ))}
        <span className="sr-only">{dict.filters}</span>
      </div>

      <div className="section-container">
        <LoadingComponent variant="cards" count={9} locale={locale} />
      </div>
    </main>
  )
}
