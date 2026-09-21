import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'

export const dynamic = 'force-dynamic'

const STATIC_ROUTES: { path: string; changeFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly'; priority: number }[] = [
  { path: '/', changeFrequency: 'hourly', priority: 1 },
  { path: '/articulos', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/markets', changeFrequency: 'daily', priority: 0.7 },
  { path: '/pivot-points', changeFrequency: 'daily', priority: 0.7 },
  { path: '/autor', changeFrequency: 'weekly', priority: 0.4 },
  { path: '/herramientas', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/aprende', changeFrequency: 'monthly', priority: 0.6 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const { data, error } = await createPublicClient()
    .from('posts')
    .select('published_at, updated_at, translations:posts_translations!inner(slug)')
    .eq('status', 'published')
    .eq('translations.locale', 'es')
    .order('published_at', { ascending: false })
    .limit(5000)

  if (error) {
    console.error('Sitemap posts query failed:', error)
    return entries
  }

  for (const post of data ?? []) {
    const translations = post.translations as unknown as { slug: string }[]
    const slug = translations?.[0]?.slug
    if (!slug) continue
    entries.push({
      url: `${SITE_URL}/articulos/${slug}`,
      lastModified: post.updated_at ?? post.published_at ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return entries
}
