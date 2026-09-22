import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CMSPanel } from '@/components/ui/CMSPanel'
import { getEditor } from '@/lib/auth'
import { getCategories, getTags, getAssets, getSources, getAssetTypes } from '@/lib/api'

export const metadata: Metadata = {
  title: 'Panel CMS',
  description: 'Panel de gestión de contenido para autores y editores.',
  robots: { index: false, follow: false },
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
