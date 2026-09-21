import { SITE_NAME, SITE_URL } from '@/lib/site'
import { createPublicClient } from '@/lib/supabase/public'
import { htmlToText } from '@/lib/sanitize'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const { data, error } = await createPublicClient()
    .from('posts')
    .select('title, published_at, created_at, translations:posts_translations!inner(slug, title, content_html, meta_description)')
    .eq('status', 'published')
    .eq('translations.locale', 'es')
    .order('published_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('RSS query failed:', error)
    return new Response('Feed no disponible', { status: 503 })
  }

  const items = (data ?? []).flatMap((post) => {
    const translation = (post.translations as unknown as {
      slug: string
      title: string
      content_html: string
      meta_description: string | null
    }[])?.[0]
    if (!translation) return []

    const link = `${SITE_URL}/articulos/${translation.slug}`
    const description = translation.meta_description || htmlToText(translation.content_html).slice(0, 280)
    const pubDate = new Date(post.published_at ?? post.created_at).toUTCString()

    return [
      `<item><title>${escapeXml(translation.title || post.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${pubDate}</pubDate><description>${escapeXml(description)}</description></item>`,
    ]
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(SITE_NAME)}</title><link>${SITE_URL}</link><description>Noticias financieras y análisis de mercados</description><language>es</language>${items.join('')}</channel></rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}
