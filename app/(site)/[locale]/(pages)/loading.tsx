import { Loading as LoadingComponent } from '@/components/ui'
import { getRouteLocale } from '@/lib/i18n/route-locale'

export default async function Loading() {
  const locale = await getRouteLocale()
  return <LoadingComponent variant="splash" locale={locale} />
}
