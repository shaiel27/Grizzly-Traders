import type { SupabaseClient } from '@supabase/supabase-js'
import { getEmailProvider } from '@/lib/email/provider'
import { createServiceClient, createSubscriberRepo } from './repo'
import type { NewsletterDeps } from './subscribe'

export interface NewsletterRuntime {
  deps: NewsletterDeps
  client: SupabaseClient
}

// URL pública del sitio para los enlaces de los correos. En producción solo se acepta la configurada:
// construirla con la cabecera Host de la petición permitiría a un atacante falsificarla y enviar a la
// víctima un enlace de confirmación que apunte a su propio dominio.
export function resolveSiteUrl(request?: Request, env: Record<string, string | undefined> = process.env): string | null {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')
  if (env.NODE_ENV === 'production') return null
  return request ? new URL(request.url).origin : 'http://localhost:3000'
}

// Devuelve null cuando falta algo imprescindible (llave de servicio, proveedor o URL): el boletín
// queda "no disponible" en vez de funcionar a medias.
export function getNewsletterRuntime(request?: Request): NewsletterRuntime | null {
  const client = createServiceClient()
  const provider = getEmailProvider()
  const siteUrl = resolveSiteUrl(request)
  if (!client || !provider || !siteUrl) return null

  return {
    client,
    deps: {
      repo: createSubscriberRepo(client),
      provider,
      siteUrl,
      logoUrl: process.env.NEWSLETTER_LOGO_URL || undefined,
      postalAddress: process.env.NEWSLETTER_POSTAL_ADDRESS,
      ipSalt: process.env.NEWSLETTER_IP_SALT,
    },
  }
}
