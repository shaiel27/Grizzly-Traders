import { Loading as LoadingComponent } from '@/components/ui'
import { getServerLocale } from '@/lib/i18n/server'

export default async function Loading() {
  const locale = await getServerLocale()
  return <LoadingComponent variant="splash" locale={locale} />
}
