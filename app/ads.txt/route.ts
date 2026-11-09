import { contenidoAdsTxt } from '@/lib/publicidad'

// /ads.txt: declara qué redes pueden vender publicidad en este sitio. Las líneas las da el panel de Adsterra y se ponen en la variable ADS_TXT
// (con \n entre líneas). Sin variable (o sin líneas válidas) responde 404: no se publica un ads.txt vacío.

export const dynamic = 'force-dynamic'

export function GET() {
  const contenido = contenidoAdsTxt(process.env.ADS_TXT)
  if (!contenido) return new Response('Not found', { status: 404 })
  return new Response(contenido, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
