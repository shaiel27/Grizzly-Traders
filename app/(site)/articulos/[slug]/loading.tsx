import { Loading as LoadingComponent } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'

export default async function ArticleLoading() {
  const locale = await getServerLocale()
  return (
    <main className="flex-1 pt-[var(--header-height)] pb-24">
      <div className="section-container max-w-4xl pt-8">
        <LoadingComponent variant="article" locale={locale} />
      </div>
    </main>
  )
}
