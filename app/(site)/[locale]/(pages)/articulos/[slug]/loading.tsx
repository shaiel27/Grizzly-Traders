import { Loading as LoadingComponent } from '@/components/ui'
import { getRouteLocale } from '@/lib/i18n/route-locale'

export default async function ArticleLoading() {
  const locale = await getRouteLocale()
  return (
    <main className="flex-1 pt-[var(--header-height-sin-ticker)] pb-24">
      <div className="section-container max-w-4xl pt-8">
        <LoadingComponent variant="article" locale={locale} />
      </div>
    </main>
  )
}
