import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPublishedPosts } from '@/lib/api'
import { localizedPost, sentimentMeta, timeAgo } from '@/lib/feed'
import { MARCADORES } from '@/lib/globe/marcadores'

// Simbolos validos = los que de verdad usan los pines del globo (lib/globe/marcadores.ts), no
// cualquier string — evita que esta ruta publica se use para filtrar noticias por un activo
// arbitrario que no tiene nada que ver con el globo.
const SIMBOLOS_VALIDOS = Array.from(new Set(MARCADORES.map((m) => m.simbolo))) as [string, ...string[]]

const schema = z.object({
  symbol: z.enum(SIMBOLOS_VALIDOS),
  locale: z.enum(['es', 'en']).default('es'),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = schema.safeParse({ symbol: searchParams.get('symbol'), locale: searchParams.get('locale') ?? undefined })
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Parametros invalidos', data: [] }, { status: 400 })
  }
  const { symbol, locale } = parsed.data

  try {
    const posts = await getPublishedPosts({ assetSymbol: symbol, limit: 3, locale })
    const data = posts.map((post) => {
      const { title, slug } = localizedPost(post, locale)
      const sentimiento = sentimentMeta(post.sentiment, locale)
      return {
        titulo: title,
        href: `/articulos/${slug}`,
        sentimientoLabel: sentimiento.label,
        sentimientoClase: sentimiento.chip,
        fecha: timeAgo(post.published_at, locale),
      }
    })
    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('Globe news API error:', error)
    return NextResponse.json({ success: false, error: 'No disponible', data: [] }, { status: 502 })
  }
}
