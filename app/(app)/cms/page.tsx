import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CMSPanel } from '@/components/ui/CMSPanel'
import { getEditor } from '@/lib/auth'
import { getCategories, getTags, getAssets, getSources, getAssetTypes } from '@/lib/api'
import { getServerLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/get-dictionary'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale).cmsPage
  return { title: dict.pageTitle, description: dict.metaDescription, robots: { index: false, follow: false } }
}

export default async function CMSPage() {
  const editor = await getEditor()
  if (editor.status !== 'ok') redirect('/login')

  const [categories, tags, assets, sources, assetTypes] = await Promise.all([
    getCategories(),
    getTags(),
    getAssets(),
    getSources(),
    getAssetTypes(),
  ])

  return (
    <CMSPanel
      initialCategories={categories}
      initialTags={tags}
      initialAssets={assets}
      initialSources={sources}
      initialAssetTypes={assetTypes}
    />
  )
}
